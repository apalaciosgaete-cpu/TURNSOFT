import {
  addDays,
  diffDays,
  eachDate,
  formatDateLong,
  isoWeekKey,
  monthKey,
  shiftEndDate,
  shiftLegalHours,
  shiftStartDate,
  weekdayISO,
} from './dates.js';
import { getHolidayMap, getHolidaysInRange } from './holidays.js';
import {
  getAllowedDailyHours,
  getEffectiveCoverage,
  getExceptionalAverageLimit,
  getOrdinaryWeeklyLimit,
  hasCertification,
  shiftCertificationsOk,
} from './model.js';
import { weeklyHoursAt } from './legal.js';
import {
  cellWorkedFraction,
  formatSlotValue,
  getExceptions,
} from './exceptions.js';

function finding(severity, code, title, detail, extra = {}) {
  return {
    id: `f-${code}-${extra.date || 'global'}-${extra.employeeId || 'all'}-${Math.random().toString(36).slice(2, 7)}`,
    severity,
    code,
    title,
    detail,
    ...extra,
  };
}

export function validateScenarioConfig(scenario) {
  const findings = [];
  const rules = scenario.rules;
  const employees = (scenario.employees || []).filter((employee) => employee.active !== false);
  const shifts = scenario.shifts || [];
  const dates = eachDate(scenario.startDate, scenario.days);
  const holidayMap = getHolidayMap(scenario.startDate, scenario.days, {
    custom: scenario.holidays || [],
    regions: scenario.regions || [],
  });

  if (!employees.length) {
    findings.push(finding('error', 'sin-personal', 'No hay trabajadores activos', 'Agrega al menos una persona para generar un horario.'));
  }
  if (!shifts.length) {
    findings.push(finding('error', 'sin-turnos', 'No hay turnos configurados', 'Define al menos una plantilla de turno.'));
  }
  if (!dates.length) {
    findings.push(finding('error', 'sin-fechas', 'Período inválido', 'Revisa la fecha de inicio y la cantidad de días.'));
  }

  const legalWeekly = weeklyHoursAt(scenario.startDate).hours;
  if (Number(rules.maxWeeklyHours) > legalWeekly + 0.001) {
    findings.push(
      finding(
        'warning',
        'jornada-sobre-legal',
        'Jornada semanal superior a la vigente',
        `La configuración declara ${rules.maxWeeklyHours} h semanales, pero para ${scenario.startDate} la referencia de jornada ordinaria es ${legalWeekly} h.`
      )
    );
  }

  if (rules.regime === 'excepcional') {
    if (!rules.exceptionalAuthorized) {
      findings.push(
        finding(
          'error',
          'excepcional-sin-autorizacion',
          'Régimen excepcional sin autorización declarada',
          'El escenario usa un régimen excepcional, pero no está marcado como autorizado. Los turnos sobre 10 h no deben generarse hasta contar con la autorización aplicable.'
        )
      );
    } else if (!rules.exceptionalReference?.trim()) {
      findings.push(
        finding(
          'warning',
          'excepcional-sin-referencia',
          'Falta referencia de autorización',
          'Registra el acto administrativo, resolución o referencia del régimen excepcional aplicable.'
        )
      );
    }
  }

  if (Number(rules.maxDailyHours) > 10) {
    findings.push(
      finding('warning', 'tope-diario-alto', 'Tope diario ordinario superior a 10 h', 'El artículo 28 del Código del Trabajo fija un máximo ordinario de 10 horas diarias.')
    );
  }
  if (Number(rules.maxExceptionalDailyHours) > 12) {
    findings.push(
      finding('warning', 'tope-excepcional-alto', 'Tope excepcional superior a 12 h', 'Revisa la autorización y el DS 48/2023 antes de programar jornadas sobre 12 horas.')
    );
  }

  for (const shift of shifts) {
    const legal = shiftLegalHours(shift);
    if (legal <= 0) {
      findings.push(finding('error', 'turno-sin-duracion', `Turno ${shift.name} sin duración válida`, 'Revisa la hora de inicio, término y la colación.'));
    } else if (legal > getAllowedDailyHours(rules) + 0.001) {
      findings.push(
        finding(
          'error',
          'turno-excede-tope',
          `Turno ${shift.name} excede el tope diario`,
          `Computa ${legal.toFixed(1)} h y el máximo aplicable es ${getAllowedDailyHours(rules)} h.`,
          { shiftId: shift.id }
        )
      );
    }

    const requiredCertifications = shift.requiredCertifications || [];
    for (const certificationName of requiredCertifications) {
      const validEmployees = employees.filter((employee) =>
        hasCertification(employee, certificationName, scenario.startDate, true)
      );
      if (!validEmployees.length) {
        findings.push(
          finding(
            'error',
            'certificacion-sin-personal',
            `Sin personal vigente para "${certificationName}"`,
            `El turno ${shift.name} exige esta certificación y ningún trabajador activo la tiene vigente al inicio del período.`,
            { shiftId: shift.id }
          )
        );
      } else {
        const required = Math.max(...(shift.coverage || [0]));
        if (validEmployees.length < required) {
          findings.push(
            finding(
              'warning',
              'certificacion-insuficiente',
              `Dotación certificada insuficiente para ${shift.name}`,
              `Se requieren hasta ${required} personas con "${certificationName}" y hay ${validEmployees.length} disponibles.`,
              { shiftId: shift.id }
            )
          );
        }
      }
    }
  }

  const duplicateEmployeeIds = employees.map((employee) => employee.id).filter((id, index, list) => list.indexOf(id) !== index);
  const duplicateShiftIds = shifts.map((shift) => shift.id).filter((id, index, list) => list.indexOf(id) !== index);
  if (duplicateEmployeeIds.length || duplicateShiftIds.length) {
    findings.push(finding('error', 'ids-duplicados', 'Identificadores duplicados', 'Hay trabajadores o turnos con el mismo identificador.'));
  }

  for (const employee of employees) {
    if (Number(employee.weeklyContractHours) > Number(rules.maxWeeklyHours) + 0.001) {
      findings.push(
        finding(
          'warning',
          'contrato-sobre-jornada',
          'Contrato sobre la jornada configurada',
          `${employee.name} tiene contrato de ${employee.weeklyContractHours} h y la jornada máxima configurada es ${rules.maxWeeklyHours} h.`,
          { employeeId: employee.id }
        )
      );
    }
  }

  const weekDemand = {};
  for (const date of dates) {
    const key = isoWeekKey(date);
    if (!weekDemand[key]) weekDemand[key] = 0;
    for (const item of getEffectiveCoverage(scenario, date, holidayMap)) {
      weekDemand[key] += item.required * shiftLegalHours(item.shift);
    }
  }
  const capacity = employees.length * (Number(rules.maxWeeklyHours) || 42);
  const overloadedWeeks = Object.entries(weekDemand).filter(([, demand]) => demand > capacity + 0.1);
  if (employees.length && overloadedWeeks.length) {
    findings.push(
      finding(
        'error',
        'dotacion-insuficiente',
        'Dotación insuficiente para la cobertura',
        `Hay ${overloadedWeeks.length} semana(s) en que la demanda supera la capacidad teórica de ${capacity.toFixed(0)} h. Agrega personal, reduce cobertura o ajusta la jornada.`
      )
    );
  }

  if (Number(rules.minSundaysOffPerMonth) > 4) {
    findings.push(
      finding('warning', 'domingos-libres-altos', 'Más domingos libres que los disponibles', 'Un mes tiene como máximo 5 domingos; revisa la regla configurada.')
    );
  }

  const holidays = getHolidaysInRange(scenario.startDate, scenario.days, {
    custom: scenario.holidays || [],
    regions: scenario.regions || [],
  });
  if (!rules.allowHolidayWork && holidays.length) {
    findings.push(
      finding(
        'info',
        'festivos-cerrado',
        'La operación se cierra en festivos',
        `Se detectaron ${holidays.length} feriado(s) en el período. La cobertura se ajustará a cero esos días porque el escenario no permite trabajar festivos.`
      )
    );
  }

  return findings;
}

export function validateSchedule(scenario, schedule) {
  const configFindings = validateScenarioConfig(scenario);
  if (!schedule) {
    return {
      findings: [
        ...configFindings,
        finding('warning', 'sin-horario', 'Sin horario generado', 'Genera un horario para revisar el cumplimiento legal.'),
      ],
      coverage: [],
      employeeMetrics: [],
      weeks: [],
      metrics: {
        errors: configFindings.filter((item) => item.severity === 'error').length,
        warnings: configFindings.filter((item) => item.severity === 'warning').length + 1,
        infos: configFindings.filter((item) => item.severity === 'info').length,
        score: 0,
        requiredSlots: 0,
        filledSlots: 0,
        coveragePct: 0,
        totalHours: 0,
        avgWeekly: 0,
        sundayShifts: 0,
        holidayShifts: 0,
        nightShifts: 0,
        expiringCertifications: 0,
        activeEmployees: (scenario.employees || []).filter((employee) => employee.active !== false).length,
        exceptions: getExceptions(scenario).length,
        absences: getExceptions(scenario).filter((exception) => exception.type === 'absence').length,
        partialAbsences: getExceptions(scenario).filter(
          (exception) => exception.type === 'absence' && exception.portion === 'half'
        ).length,
        swaps: getExceptions(scenario).filter((exception) => exception.type === 'swap').length,
        coverages: getExceptions(scenario).filter((exception) => exception.type === 'coverage').length,
      },
      holidayMap: {},
      holidays: [],
    };
  }

  const rules = scenario.rules;
  const dates = eachDate(schedule.startDate || scenario.startDate, schedule.days || scenario.days);
  const holidayMap = getHolidayMap(dates[0], dates.length, {
    custom: scenario.holidays || [],
    regions: scenario.regions || [],
  });
  const holidays = getHolidaysInRange(dates[0], dates.length, {
    custom: scenario.holidays || [],
    regions: scenario.regions || [],
  });
  const employees = (scenario.employees || []).filter((employee) => employee.active !== false);
  const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));
  const shiftMap = new Map((scenario.shifts || []).map((shift) => [shift.id, shift]));
  const exceptions = getExceptions(scenario);
  const dateSet = new Set(dates);
  const allowedDaily = getAllowedDailyHours(rules);
  const ordinaryWeekly = getOrdinaryWeeklyLimit(rules);
  const exceptionalAverage = getExceptionalAverageLimit(rules);
  const maxConsecutive = Number(rules.maxConsecutiveWorkDays) || 6;
  const maxNight = Number(rules.maxConsecutiveNightShifts) || 6;
  const minRest = Number(rules.minRestBetweenShifts) || 0;
  const minWeeklyRest = Number(rules.minWeeklyRestHours) || 24;
  const minSundaysOff = Number(rules.minSundaysOffPerMonth) || 0;
  const findings = [...configFindings];
  const coverage = [];
  const weeksMap = {};
  const employeeMetrics = [];
  const sundays = dates.filter((date) => weekdayISO(date) === 7);

  let requiredSlots = 0;
  let filledSlots = 0;
  let totalHours = 0;
  let sundayShifts = 0;
  let holidayShifts = 0;
  let nightShifts = 0;
  let expiringCertifications = 0;

  for (const date of dates) {
    const isSunday = weekdayISO(date) === 7;
    const holiday = holidayMap[date];
    const weekKey = isoWeekKey(date);
    if (!weeksMap[weekKey]) {
      weeksMap[weekKey] = { weekKey, required: 0, filled: 0, hours: 0, startDate: date, endDate: date };
    }
    weeksMap[weekKey].endDate = date;

    const items = getEffectiveCoverage(scenario, date, holidayMap);
    const byShift = [];
    let requiredToday = 0;
    let filledToday = 0;

    for (const item of items) {
      requiredToday += item.required;
      let assigned = 0;
      for (const employee of employees) {
        const cell = schedule.cells?.[employee.id]?.[date];
        if (cell?.shiftId !== item.shift.id) continue;
        assigned += cellWorkedFraction(cell);
      }
      const effectiveAssigned = Math.min(assigned, item.required);
      filledToday += effectiveAssigned;
      byShift.push({
        shiftId: item.shift.id,
        shiftName: item.shift.name,
        required: item.required,
        assigned,
        missing: Math.max(0, item.required - assigned),
        extra: Math.max(0, assigned - item.required),
      });
    }

    requiredSlots += requiredToday;
    filledSlots += filledToday;
    weeksMap[weekKey].required += requiredToday;
    weeksMap[weekKey].filled += filledToday;

    const missing = requiredToday - filledToday;
    if (missing > 0) {
      const detail = byShift
        .filter((item) => item.missing > 0)
        .map((item) => `${item.shiftName}: faltan ${formatSlotValue(item.missing)}`)
        .join(' · ');
      findings.push(
        finding(
          rules.requireFullCoverage ? 'error' : 'warning',
          'cobertura-incompleta',
          `Cobertura incompleta el ${formatDateLong(date)}`,
          detail,
          { date }
        )
      );
    }

    const extras = byShift.filter((item) => item.extra > 0);
    if (extras.length) {
      findings.push(
        finding(
          'info',
          'cobertura-excedente',
          `Dotación por sobre la cobertura el ${formatDateLong(date)}`,
          extras.map((item) => `${item.shiftName}: ${formatSlotValue(item.extra)} extra`).join(' · '),
          { date }
        )
      );
    }

    coverage.push({
      date,
      weekday: weekdayISO(date),
      isSunday,
      isHoliday: Boolean(holiday),
      holidayName: holiday?.name || '',
      required: requiredToday,
      assigned: filledToday,
      missing: Math.max(0, missing),
      byShift,
    });
  }

  const seenExceptionIds = new Set();
  for (const exception of exceptions) {
    if (!exception?.id || !exception.type) {
      findings.push(
        finding('warning', 'novedad-incompleta', 'Novedad incompleta', 'Hay una novedad sin identificador o tipo y no se pudo validar.')
      );
      continue;
    }
    if (seenExceptionIds.has(exception.id)) {
      findings.push(
        finding('warning', 'novedad-duplicada', 'Novedad duplicada', `El identificador ${exception.id} aparece más de una vez.`)
      );
      continue;
    }
    seenExceptionIds.add(exception.id);

    const employee = employeeMap.get(exception.employeeId);
    if (!employee) {
      findings.push(
        finding(
          'warning',
          'novedad-sin-trabajador',
          'Novedad asociada a un trabajador inexistente',
          `La novedad ${exception.id} apunta a una persona que no está activa en el escenario.`
        )
      );
      continue;
    }

    if (exception.type === 'absence') {
      if (!dateSet.has(exception.date)) {
        findings.push(
          finding(
            'warning',
            'novedad-fuera-periodo',
            'Ausencia fuera del período',
            `${employee.name} tiene una ausencia el ${exception.date}, fuera del rango planificado.`,
            { employeeId: employee.id, date: exception.date }
          )
        );
        continue;
      }
      const cell = schedule.cells?.[employee.id]?.[exception.date];
      if (cell?.type !== 'absence') {
        findings.push(
          finding(
            'warning',
            'novedad-desincronizada',
            'Ausencia no reflejada en la grilla',
            `${employee.name} tiene una ausencia registrada el ${formatDateLong(exception.date)}, pero la celda no está marcada como ausencia.`,
            { employeeId: employee.id, date: exception.date }
          )
        );
        continue;
      }
      const portion = exception.portion === 'half' ? 'medio turno' : 'día completo';
      const detail =
        exception.portion === 'half'
          ? `${employee.name} no trabajará la mitad del turno del ${formatDateLong(exception.date)}. El tramo restante queda sujeto a cobertura.`
          : `${employee.name} no trabajará el ${formatDateLong(exception.date)}.`;
      findings.push(
        finding('info', 'ausencia-registrada', `Ausencia de ${portion}`, detail, {
          employeeId: employee.id,
          date: exception.date,
        })
      );
    } else if (exception.type === 'coverage') {
      if (!dateSet.has(exception.date)) {
        findings.push(
          finding(
            'warning',
            'novedad-fuera-periodo',
            'Cobertura fuera del período',
            `La cobertura del ${exception.date} está fuera del rango planificado.`,
            { employeeId: employee.id, date: exception.date }
          )
        );
        continue;
      }
      const replacement = employeeMap.get(exception.replacementId);
      if (!replacement) {
        findings.push(
          finding(
            'warning',
            'cobertura-sin-reemplazo',
            'Cobertura sin reemplazo válido',
            `${employee.name} tiene una cobertura asignada a una persona que no está activa.`,
            { employeeId: employee.id, date: exception.date }
          )
        );
        continue;
      }
      const replacementCell = schedule.cells?.[replacement.id]?.[exception.date];
      if (replacementCell?.type !== 'shift' || replacementCell.shiftId !== exception.shiftId) {
        findings.push(
          finding(
            'warning',
            'cobertura-desincronizada',
            'Cobertura no reflejada en la grilla',
            `${replacement.name} figura como reemplazo de ${employee.name} el ${formatDateLong(exception.date)}, pero la celda no tiene el turno correspondiente.`,
            { employeeId: employee.id, date: exception.date }
          )
        );
        continue;
      }
      findings.push(
        finding(
          'info',
          'cobertura-registrada',
          'Cobertura de inasistencia',
          `${replacement.name} cubre a ${employee.name} el ${formatDateLong(exception.date)}.`,
          { employeeId: employee.id, date: exception.date }
        )
      );
    } else if (exception.type === 'swap') {
      if (!dateSet.has(exception.offDate) || !dateSet.has(exception.workDate)) {
        findings.push(
          finding(
            'warning',
            'novedad-fuera-periodo',
            'Cambio de descanso fuera del período',
            `${employee.name} tiene un cambio de día libre con fechas fuera del rango planificado.`,
            { employeeId: employee.id }
          )
        );
        continue;
      }
      findings.push(
        finding(
          'info',
          'permuta-descanso',
          'Cambio de día libre',
          `${employee.name} mueve su descanso del ${formatDateLong(exception.offDate)} al ${formatDateLong(exception.workDate)}.`,
          { employeeId: employee.id, date: exception.offDate }
        )
      );
    } else {
      findings.push(
        finding('warning', 'novedad-desconocida', 'Tipo de novedad desconocido', `La novedad ${exception.id} usa el tipo "${exception.type}".`)
      );
    }
  }

  const allAssignments = [];
  for (const employee of employees) {
    const assignments = [];
    for (const date of dates) {
      const cell = schedule.cells?.[employee.id]?.[date];
      const fraction = cellWorkedFraction(cell);
      if (!fraction) continue;
      const shift = shiftMap.get(cell.shiftId);
      if (!shift) {
        findings.push(
          finding('error', 'turno-inexistente', 'Turno inexistente en el horario', `${employee.name} tiene un turno que ya no existe el ${formatDateLong(date)}.`, {
            date,
            employeeId: employee.id,
          })
        );
        continue;
      }
      assignments.push({ date, shift, cell, fraction });
    }
    allAssignments.push({ employee, assignments });
  }

  for (const { employee, assignments } of allAssignments) {
    let hours = 0;
    let workedDays = 0;
    let nights = 0;
    let sundaysWorked = 0;
    let holidaysWorked = 0;
    let maxConsecutiveForEmployee = 0;
    let currentConsecutive = 0;
    let maxNightForEmployee = 0;
    let currentNight = 0;
    let restMinimum = Infinity;
    let maxWeeklyRest = 0;
    let previous = null;
    const weekly = {};
    const weekDays = {};
    const sundayOffByMonth = {};

    for (const item of assignments) {
      const { date, shift } = item;
      const legal = shiftLegalHours(shift) * item.fraction;
      hours += legal;
      totalHours += legal;
      workedDays += item.fraction;
      if (shift.night) {
        nights += 1;
        nightShifts += 1;
      }
      if (weekdayISO(date) === 7) {
        sundaysWorked += 1;
        sundayShifts += 1;
      }
      if (holidayMap[date]) {
        holidaysWorked += 1;
        holidayShifts += 1;
      }

      const weekKey = isoWeekKey(date);
      weekly[weekKey] = (weekly[weekKey] || 0) + legal;
      weekDays[weekKey] = (weekDays[weekKey] || 0) + 1;

      if (previous && diffDays(previous.date, date) === 1) {
        currentConsecutive += 1;
      } else {
        currentConsecutive = 1;
      }
      maxConsecutiveForEmployee = Math.max(maxConsecutiveForEmployee, currentConsecutive);

      if (shift.night && previous && diffDays(previous.date, date) === 1 && previous.shift.night) {
        currentNight += 1;
      } else {
        currentNight = shift.night ? 1 : 0;
      }
      maxNightForEmployee = Math.max(maxNightForEmployee, currentNight);

      if (previous) {
        const rest = (shiftStartDate(date, shift).getTime() - shiftEndDate(previous.date, previous.shift).getTime()) / 3600000;
        restMinimum = Math.min(restMinimum, rest);
        maxWeeklyRest = Math.max(maxWeeklyRest, rest);
        if (rest < minRest - 0.02) {
          findings.push(
            finding(
              'error',
              'descanso-insuficiente',
              `Descanso entre jornadas insuficiente`,
              `${employee.name}: ${rest.toFixed(1)} h entre el turno del ${formatDateLong(previous.date)} y el del ${formatDateLong(date)}. Mínimo configurado: ${minRest} h.`,
              { date, employeeId: employee.id }
            )
          );
        }
      }

      const allowedForShift = legal <= allowedDaily + 0.001;
      if (!allowedForShift) {
        findings.push(
          finding(
            'error',
            'jornada-diaria-excedida',
            'Jornada diaria sobre el máximo',
            `${employee.name}: ${legal.toFixed(1)} h el ${formatDateLong(date)}; máximo aplicable ${allowedDaily} h.`,
            { date, employeeId: employee.id }
          )
        );
      }

      if (!shiftCertificationsOk(employee, shift, date, rules.requireCertifications)) {
        const missingCertifications = (shift.requiredCertifications || []).filter(
          (name) => !hasCertification(employee, name, date, true)
        );
        findings.push(
          finding(
            rules.requireCertifications ? 'error' : 'warning',
            'certificacion-vencida',
            'Certificación faltante o vencida',
            `${employee.name} no tiene vigente: ${missingCertifications.join(', ')} al ${formatDateLong(date)} (turno ${shift.name}).`,
            { date, employeeId: employee.id }
          )
        );
      }

      if (weekdayISO(date) === 7 && !rules.allowSundayWork) {
        findings.push(
          finding('error', 'domingo-no-autorizado', 'Trabajo dominical no autorizado', `${employee.name} tiene turno el domingo ${formatDateLong(date)}.`, {
            date,
            employeeId: employee.id,
          })
        );
      }
      if (holidayMap[date] && !rules.allowHolidayWork) {
        findings.push(
          finding('error', 'festivo-no-autorizado', 'Trabajo en festivo no autorizado', `${employee.name} tiene turno el feriado ${formatDateLong(date)}.`, {
            date,
            employeeId: employee.id,
          })
        );
      }
      if ((employee.unavailableWeekdays || []).includes(weekdayISO(date))) {
        findings.push(
          finding('error', 'disponibilidad-incumplida', 'Turno en día no disponible', `${employee.name} no está disponible los ${formatDateLong(date)}.`, {
            date,
            employeeId: employee.id,
          })
        );
      }

      previous = item;
    }

    if (maxConsecutiveForEmployee > maxConsecutive) {
      findings.push(
        finding(
          'error',
          'dias-consecutivos',
          'Exceso de días consecutivos',
          `${employee.name} acumula ${maxConsecutiveForEmployee} días seguidos; el máximo configurado es ${maxConsecutive}.`,
          { employeeId: employee.id }
        )
      );
    }

    if (maxNightForEmployee > maxNight) {
      findings.push(
        finding(
          'error',
          'noches-consecutivas',
          'Exceso de noches consecutivas',
          `${employee.name} acumula ${maxNightForEmployee} noches seguidas; el máximo configurado es ${maxNight}.`,
          { employeeId: employee.id }
        )
      );
    }

    for (const [weekKey, weekHours] of Object.entries(weekly)) {
      if (rules.regime === 'ordinaria' && weekHours > ordinaryWeekly + 0.01) {
        findings.push(
          finding(
            'error',
            'jornada-semanal-excedida',
            'Jornada semanal excedida',
            `${employee.name}: ${weekHours.toFixed(1)} h en ${weekKey}; máximo ${ordinaryWeekly} h.`,
            { employeeId: employee.id, weekKey }
          )
        );
      }
      if (rules.regime === 'ordinaria' && (weekDays[weekKey] || 0) > Number(rules.maxDaysPerWeek || 6)) {
        findings.push(
          finding(
            'error',
            'dias-semana-excedidos',
            'Distribución semanal excedida',
            `${employee.name}: ${weekDays[weekKey]} días en ${weekKey}; máximo ${rules.maxDaysPerWeek}.`,
            { employeeId: employee.id, weekKey }
          )
        );
      }
    }

    const averageWeekly = hours / (dates.length / 7);
    if (rules.regime === 'excepcional' && averageWeekly > exceptionalAverage + 0.01) {
      findings.push(
        finding(
          'error',
          'promedio-excepcional',
          'Promedio semanal excepcional excedido',
          `${employee.name}: ${averageWeekly.toFixed(1)} h promedio semanal; máximo ${exceptionalAverage} h.`,
          { employeeId: employee.id }
        )
      );
    }

    if (maxWeeklyRest > 0 && maxWeeklyRest < minWeeklyRest) {
      findings.push(
        finding(
          'warning',
          'descanso-semanal',
          'Descanso semanal bajo el mínimo configurado',
          `${employee.name}: el mayor descanso continuo entre turnos es ${maxWeeklyRest.toFixed(1)} h; referencia ${minWeeklyRest} h.`,
          { employeeId: employee.id }
        )
      );
    }

    if (employee.weeklyContractHours > 0) {
      const deviation = ((averageWeekly - employee.weeklyContractHours) / employee.weeklyContractHours) * 100;
      if (deviation > 15) {
        findings.push(
          finding(
            'warning',
            'sobretiempo',
            'Horas por sobre el contrato',
            `${employee.name}: ${averageWeekly.toFixed(1)} h promedio semanal vs ${employee.weeklyContractHours} h de contrato (${deviation.toFixed(0)}% más).`,
            { employeeId: employee.id }
          )
        );
      }
    }

    const months = {};
    for (const date of dates) {
      if (weekdayISO(date) !== 7) continue;
      const key = monthKey(date);
      if (!months[key]) months[key] = { total: 0, worked: 0 };
      months[key].total += 1;
      if (cellWorkedFraction(schedule.cells?.[employee.id]?.[date]) > 0) months[key].worked += 1;
    }
    for (const [key, value] of Object.entries(months)) {
      const off = value.total - value.worked;
      sundayOffByMonth[key] = off;
      if (value.total >= 4 && off < minSundaysOff) {
        findings.push(
          finding(
            'warning',
            'domingos-libres',
            'Domingos libres insuficientes',
            `${employee.name}: ${off} domingo(s) libre(s) en ${key}; la regla configurada exige ${minSundaysOff}.`,
            { employeeId: employee.id, monthKey: key }
          )
        );
      }
    }

    const expiring = (employee.certifications || []).filter((certification) => {
      if (!certification.expiresAt) return false;
      const days = diffDays(dates[dates.length - 1], certification.expiresAt);
      return days >= 0 && days <= 45;
    });
    expiringCertifications += expiring.length;
    for (const certification of expiring) {
      findings.push(
        finding(
          'warning',
          'certificacion-por-vencer',
          'Certificación por vencer',
          `${employee.name}: "${certification.name}" vence el ${certification.expiresAt}.`,
          { employeeId: employee.id }
        )
      );
    }

    const absenceCells = dates
      .map((date) => schedule.cells?.[employee.id]?.[date])
      .filter((cell) => cell?.type === 'absence');
    const absences = absenceCells.filter((cell) => cell.portion !== 'half').length;
    const halfDays = absenceCells.filter((cell) => cell.portion === 'half').length;
    const coverages = exceptions.filter(
      (exception) => exception.type === 'coverage' && exception.replacementId === employee.id
    ).length;

    employeeMetrics.push({
      employeeId: employee.id,
      name: employee.name,
      role: employee.role,
      contractHours: employee.weeklyContractHours,
      hours,
      daysWorked: Math.round(workedDays * 10) / 10,
      weeklyAverage: averageWeekly,
      shifts: assignments.length,
      absences,
      halfDays,
      coverages,
      sundaysWorked,
      sundaysOff: sundays.length - sundaysWorked,
      sundayOffByMonth,
      holidaysWorked,
      nights,
      maxConsecutive: maxConsecutiveForEmployee,
      maxNightStreak: maxNightForEmployee,
      minRest: Number.isFinite(restMinimum) ? restMinimum : null,
      maxWeeklyRest,
      weeksOver: Object.values(weekly).filter((value) => rules.regime === 'ordinaria' && value > ordinaryWeekly + 0.01).length,
      certifications: employee.certifications || [],
    });
  }

  const errors = findings.filter((item) => item.severity === 'error').length;
  const warnings = findings.filter((item) => item.severity === 'warning').length;
  const infos = findings.filter((item) => item.severity === 'info').length;
  const severityOrder = { error: 0, warning: 1, info: 2 };
  findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const weeks = Object.values(weeksMap).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const activeEmployees = employees.length;

  return {
    findings,
    coverage,
    employeeMetrics,
    weeks,
    holidayMap,
    holidays,
    metrics: {
      errors,
      warnings,
      infos,
      score: Math.max(0, Math.min(100, 100 - errors * 10 - warnings * 2)),
      requiredSlots,
      filledSlots,
      coveragePct: requiredSlots ? (filledSlots / requiredSlots) * 100 : 100,
      totalHours,
      avgWeekly: activeEmployees ? totalHours / activeEmployees / (dates.length / 7) : 0,
      sundayShifts,
      holidayShifts,
      nightShifts,
      expiringCertifications,
      activeEmployees,
      exceptions: exceptions.length,
      absences: exceptions.filter((exception) => exception.type === 'absence').length,
      partialAbsences: exceptions.filter(
        (exception) => exception.type === 'absence' && exception.portion === 'half'
      ).length,
      swaps: exceptions.filter((exception) => exception.type === 'swap').length,
      coverages: exceptions.filter((exception) => exception.type === 'coverage').length,
      days: dates.length,
      startDate: dates[0],
      endDate: dates[dates.length - 1],
      averageHourSpread: employeeMetrics.length
        ? employeeMetrics.reduce((sum, employee) => sum + Math.abs(employee.weeklyAverage - employee.contractHours), 0) / employeeMetrics.length
        : 0,
    },
  };
}
