import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const scheduler = require('../src/services/scheduler.js');

test('el catálogo expone los cinco sectores y la referencia legal', async () => {
  const presets = await scheduler.getPresets();
  assert.deepEqual(
    presets.sectors.map((sector) => sector.id).sort(),
    ['logistica', 'mineria', 'retail', 'salud', 'seguridad']
  );
  assert.match(presets.legalVersion, /2026/);
  assert.equal(presets.demos.length, 5);
});

test('genera y valida los cinco escenarios demo sin errores', async () => {
  const presets = await scheduler.getPresets();
  for (const demo of presets.demos) {
    const { schedule, validation } = await scheduler.plan(demo, {
      patternAttempts: 40,
      greedyAttempts: 25,
    });
    assert.equal(validation.metrics.coveragePct, 100, `${demo.sector}: cobertura incompleta`);
    assert.equal(validation.metrics.errors, 0, `${demo.sector}: errores de cumplimiento`);
    assert.ok(schedule.meta.strategy, `${demo.sector}: sin estrategia`);
    assert.equal(Object.keys(schedule.cells).length, demo.employees.length);
  }
});

test('un escenario armado desde la API se normaliza y valida', async () => {
  const scenario = await scheduler.scenarioFromRequest({
    sector: 'retail',
    startDate: '2026-11-30',
    days: 28,
  });
  const { validation } = await scheduler.plan(scenario, {
    patternAttempts: 25,
    greedyAttempts: 15,
  });
  assert.equal(validation.metrics.errors, 0);
  assert.equal(validation.metrics.coveragePct, 100);
});

test('equilibra la cuadrilla 4x4 en un período de 28 días', async () => {
  const presets = await scheduler.getPresets();
  const base = presets.demos.find((demo) => demo.sector === 'seguridad');
  const scenario = { ...base, days: 28 };
  const { schedule, validation } = await scheduler.plan(scenario, {
    patternAttempts: 0,
    greedyAttempts: 10,
  });
  assert.equal(schedule.meta.strategy, 'cuadrillas-4x4');
  assert.equal(validation.metrics.coveragePct, 100);
  assert.equal(validation.metrics.errors, 0);
  const daysWorked = validation.employeeMetrics.map((employee) => employee.daysWorked);
  assert.equal(Math.max(...daysWorked), Math.min(...daysWorked));
});

test('una ausencia de medio turno descuenta horas y deja cobertura fraccionaria', async () => {
  const shared = await scheduler.loadShared();
  const demo = shared.demo.createDemoScenarios().find((item) => item.sector === 'seguridad');
  const schedule = shared.engine.generateSchedule(demo, {
    patternAttempts: 40,
    greedyAttempts: 25,
  });
  const baseline = shared.validate.validateSchedule(demo, schedule);

  let target = null;
  for (const employee of demo.employees) {
    for (const [date, cell] of Object.entries(schedule.cells?.[employee.id] || {})) {
      if (cell?.type === 'shift') {
        target = { employee, date, cell };
        break;
      }
    }
    if (target) break;
  }
  assert.ok(target, 'el escenario demo debe tener al menos un turno');

  const shift = demo.shifts.find((item) => item.id === target.cell.shiftId);
  const exception = {
    id: 'exc-half',
    type: 'absence',
    employeeId: target.employee.id,
    date: target.date,
    portion: 'half',
    halfPeriod: 'first',
    shiftId: target.cell.shiftId,
    previousCell: { ...target.cell },
    reason: 'Trámite personal',
  };
  const cells = {
    ...schedule.cells,
    [target.employee.id]: {
      ...schedule.cells[target.employee.id],
      [target.date]: {
        type: 'absence',
        portion: 'half',
        halfPeriod: 'first',
        shiftId: target.cell.shiftId,
        exceptionId: exception.id,
        reason: exception.reason,
      },
    },
  };
  const scenario = { ...demo, exceptions: [exception], schedule: { ...schedule, cells } };
  const validation = shared.validate.validateSchedule(scenario, scenario.schedule);
  const before = baseline.employeeMetrics.find((item) => item.employeeId === target.employee.id);
  const after = validation.employeeMetrics.find((item) => item.employeeId === target.employee.id);
  const expectedDrop = shared.dates.shiftLegalHours(shift) / 2;

  assert.ok(Math.abs(before.hours - after.hours - expectedDrop) < 0.01);
  assert.equal(validation.metrics.partialAbsences, 1);
  assert.ok(
    validation.coverage.some(
      (item) => item.date === target.date && item.assigned < item.required
    )
  );
  assert.ok(validation.findings.some((finding) => finding.code === 'ausencia-registrada'));
});

test('la cobertura de una inasistencia reemplaza el cupo y registra al reemplazo', async () => {
  const shared = await scheduler.loadShared();
  const demo = shared.demo.createDemoScenarios().find((item) => item.sector === 'seguridad');
  const schedule = shared.engine.generateSchedule(demo, {
    patternAttempts: 40,
    greedyAttempts: 25,
  });
  const baseline = shared.validate.validateSchedule(demo, schedule);

  let target = null;
  for (const employee of demo.employees) {
    for (const [date, cell] of Object.entries(schedule.cells?.[employee.id] || {})) {
      if (cell?.type !== 'shift') continue;
      const shift = demo.shifts.find((item) => item.id === cell.shiftId);
      const replacement = demo.employees.find(
        (candidate) =>
          candidate.id !== employee.id &&
          schedule.cells?.[candidate.id]?.[date]?.type === 'off' &&
          shared.model.shiftCertificationsOk(
            candidate,
            shift,
            date,
            demo.rules.requireCertifications
          )
      );
      if (replacement) {
        target = { employee, date, cell, shift, replacement };
        break;
      }
    }
    if (target) break;
  }
  assert.ok(target, 'debe existir una persona libre para cubrir la inasistencia');

  const absence = {
    id: 'exc-abs',
    type: 'absence',
    employeeId: target.employee.id,
    date: target.date,
    portion: 'full',
    shiftId: target.cell.shiftId,
    previousCell: { ...target.cell },
  };
  const coverage = {
    id: 'cov-1',
    type: 'coverage',
    employeeId: target.employee.id,
    date: target.date,
    replacementId: target.replacement.id,
    shiftId: target.cell.shiftId,
    absenceId: absence.id,
    previousCell: { type: 'off' },
  };
  const cells = {
    ...schedule.cells,
    [target.employee.id]: {
      ...schedule.cells[target.employee.id],
      [target.date]: {
        type: 'absence',
        portion: 'full',
        shiftId: target.cell.shiftId,
        exceptionId: absence.id,
      },
    },
    [target.replacement.id]: {
      ...schedule.cells[target.replacement.id],
      [target.date]: { type: 'shift', shiftId: target.cell.shiftId },
    },
  };
  const scenario = {
    ...demo,
    exceptions: [absence, coverage],
    schedule: { ...schedule, cells },
  };
  const validation = shared.validate.validateSchedule(scenario, scenario.schedule);
  const day = validation.coverage.find((item) => item.date === target.date);
  const before = baseline.employeeMetrics.find(
    (item) => item.employeeId === target.employee.id
  );
  const after = validation.employeeMetrics.find(
    (item) => item.employeeId === target.employee.id
  );

  assert.equal(day.missing, 0);
  assert.equal(validation.metrics.coverages, 1);
  assert.ok(after.hours < before.hours);
  assert.ok(validation.findings.some((finding) => finding.code === 'cobertura-registrada'));
});

test('el cambio de día libre conserva horas y puede anularse exactamente', async () => {
  const shared = await scheduler.loadShared();
  const demo = shared.demo.createDemoScenarios().find((item) => item.sector === 'seguridad');
  const schedule = shared.engine.generateSchedule(demo, {
    patternAttempts: 40,
    greedyAttempts: 25,
  });
  const baseline = shared.validate.validateSchedule(demo, schedule);
  const clone = (value) => JSON.parse(JSON.stringify(value));

  let target = null;
  for (const employee of demo.employees) {
    const entries = Object.entries(schedule.cells?.[employee.id] || {});
    for (let index = 0; index < entries.length - 1; index += 1) {
      const [firstDate, firstCell] = entries[index];
      const [secondDate, secondCell] = entries[index + 1];
      if (
        (firstCell.type === 'off' && secondCell.type === 'shift') ||
        (firstCell.type === 'shift' && secondCell.type === 'off')
      ) {
        const offDate = firstCell.type === 'off' ? firstDate : secondDate;
        const workDate = firstCell.type === 'off' ? secondDate : firstDate;
        target = {
          employee,
          offDate,
          workDate,
          offCell: firstCell.type === 'off' ? firstCell : secondCell,
          workCell: firstCell.type === 'shift' ? firstCell : secondCell,
        };
        break;
      }
    }
    if (target) break;
  }
  assert.ok(target, 'debe existir un par libre/turno para permutar');

  const swap = {
    id: 'swap-1',
    type: 'swap',
    employeeId: target.employee.id,
    offDate: target.offDate,
    workDate: target.workDate,
    offCell: clone(target.offCell),
    workCell: clone(target.workCell),
  };
  const cells = {
    ...schedule.cells,
    [target.employee.id]: {
      ...schedule.cells[target.employee.id],
      [target.offDate]: clone(target.workCell),
      [target.workDate]: clone(target.offCell),
    },
  };
  const scenario = { ...demo, exceptions: [swap], schedule: { ...schedule, cells } };
  const validation = shared.validate.validateSchedule(scenario, scenario.schedule);
  const before = baseline.employeeMetrics.find(
    (item) => item.employeeId === target.employee.id
  );
  const after = validation.employeeMetrics.find(
    (item) => item.employeeId === target.employee.id
  );

  assert.ok(Math.abs(before.hours - after.hours) < 0.01);
  assert.equal(validation.metrics.swaps, 1);
  assert.ok(validation.findings.some((finding) => finding.code === 'permuta-descanso'));

  const undone = shared.exceptions.undoException(
    { cells: scenario.schedule.cells, exceptions: scenario.exceptions },
    swap.id
  );
  assert.deepEqual(undone.cells[target.employee.id][target.offDate], target.offCell);
  assert.deepEqual(undone.cells[target.employee.id][target.workDate], target.workCell);
  assert.equal(undone.exceptions.length, 0);
});

test('convierte asignaciones de puestos de base de datos en filas de horarios', async () => {
  const scenario = {
    id: 'db-test',
    name: 'Prueba BD',
    company: 'Empresa',
    sector: 'seguridad',
    startDate: '2026-11-30',
    days: 4,
    employees: [
      { id: 'e1', name: 'Persona Uno', role: 'Guardia', weeklyContractHours: 42, active: true },
    ],
    shifts: [
      {
        id: 'p1',
        dbPuestoId: 'p1',
        name: 'Día',
        code: 'D12',
        start: '08:00',
        end: '20:00',
        breakMinutes: 60,
        night: false,
        coverage: [1, 0, 0, 0, 0, 0, 0],
        requiredCertifications: [],
      },
    ],
    rules: (await scheduler.loadShared()).presets.getSectorRules('seguridad'),
    holidays: [],
    regions: [],
  };
  const { schedule } = await scheduler.plan(scenario, { patternAttempts: 5, greedyAttempts: 5 });
  const rows = await scheduler.assignmentsToRows(scenario, schedule, { escenarioId: 'sch-1' });
  assert.ok(rows.length > 0);
  assert.equal(rows[0].puesto_id, 'p1');
  assert.equal(rows[0].escenario_id, 'sch-1');
  assert.ok(rows[0].hora_inicio instanceof Date);
  assert.ok(rows[0].hora_fin instanceof Date);
  assert.equal(rows[0].horas_trabajadas, 11);
});
