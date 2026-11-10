/**
 * Servicio de planificación multi-sector.
 *
 * Envuelve el motor y el validador compartidos de TURNSOFT (`shared/`), que se
 * escriben como módulos ESM para poder usarse también desde el frontend. Desde
 * el backend CommonJS se cargan con `import()` dinámico y se cachean.
 */
const path = require('path');
const { pathToFileURL } = require('url');

const SHARED_DIR = path.resolve(__dirname, '../../../shared');

const PALETTE = [
  '#0f766e',
  '#0284c7',
  '#7c3aed',
  '#db2777',
  '#b45309',
  '#059669',
  '#dc2626',
  '#475569',
  '#4338ca',
  '#0e7490',
];

let modulesPromise = null;

function loadShared() {
  if (!modulesPromise) {
    const load = (file) => import(pathToFileURL(path.join(SHARED_DIR, file)).href);
    modulesPromise = Promise.all([
      load('engine.js'),
      load('validate.js'),
      load('model.js'),
      load('presets.js'),
      load('demo.js'),
      load('legal.js'),
      load('dates.js'),
      load('holidays.js'),
      load('exceptions.js'),
    ])
      .then(([engine, validate, model, presets, demo, legal, dates, holidays, exceptions]) => ({
        engine,
        validate,
        model,
        presets,
        demo,
        legal,
        dates,
        holidays,
        exceptions,
      }))
      .catch((error) => {
        modulesPromise = null;
        throw error;
      });
  }
  return modulesPromise;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function boolOrNull(value) {
  if (value === null || value === undefined) return null;
  return Boolean(value);
}

function normalizeTime(value, fallback) {
  if (!value) return fallback;
  const text = String(value);
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return fallback;
  return `${String(match[1]).padStart(2, '0')}:${match[2]}`;
}

function normalizeCoverage(value, fallback = 1) {
  if (!Array.isArray(value) || value.length !== 7) {
    return Array.from({ length: 7 }, (_, index) => (index < 6 ? Number(fallback) || 0 : 0));
  }
  return value.map((item) => Math.max(0, Number(item) || 0));
}

function normalizeCertifications(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return { id: item, name: item, expiresAt: '' };
        if (!item || !item.name) return null;
        return {
          id: item.id || item.name,
          name: item.name,
          expiresAt: item.expiresAt || item.fecha_vencimiento || '',
          issuer: item.issuer || item.emitido_por || '',
        };
      })
      .filter(Boolean);
  }
  return [];
}

/** Convierte la fila de configuración legal en overrides del preset sectorial. */
function legalOverrides(config = {}) {
  const map = {
    maxWeeklyHours: numberOrNull(config.jornada_maxima_semanal),
    maxDailyHours: numberOrNull(config.max_daily_hours),
    maxExceptionalDailyHours: numberOrNull(config.max_exceptional_daily_hours),
    maxExceptionalAverageWeeklyHours: numberOrNull(config.max_exceptional_average_weekly_hours),
    minRestBetweenShifts: numberOrNull(config.descanso_minimo_entre_turnos),
    maxConsecutiveWorkDays: numberOrNull(config.max_consecutive_work_days),
    blockRestDays: numberOrNull(config.block_rest_days),
    minSundaysOffPerMonth: numberOrNull(config.min_sundays_off_per_month),
    maxConsecutiveNightShifts: numberOrNull(config.max_consecutive_night_shifts),
    sundayPremiumPercent: numberOrNull(config.recargo_dominical_festivo),
    holidayPremiumPercent: numberOrNull(config.recargo_festivo),
    allowSundayWork: boolOrNull(config.allow_sunday_work),
    allowHolidayWork: boolOrNull(config.allow_holiday_work),
    requireCertifications: boolOrNull(config.require_certifications),
    requireFullCoverage: boolOrNull(config.require_full_coverage),
  };
  return Object.fromEntries(Object.entries(map).filter(([, value]) => value !== null));
}

/**
 * Construye un escenario compatible con el motor compartido a partir de las
 * entidades históricas del backend (empresas, guardias, puestos, plantillas).
 */
async function buildScenarioFromDb({
  empresa = {},
  cliente = null,
  sucursal = null,
  guardias = [],
  puestos = [],
  config = null,
  startDate,
  days,
  sector: sectorOverride,
  name,
  notes,
}) {
  const shared = await loadShared();
  const sector = sectorOverride || cliente?.sector || empresa.sector || 'seguridad';
  const baseRules = shared.presets.getSectorRules(sector);
  const enginePreset = shared.presets.SECTOR_ENGINE_PRESETS[sector] || shared.presets.SECTOR_ENGINE_PRESETS.logistica;

  const rules = {
    ...baseRules,
    ...legalOverrides(config || {}),
    regime: empresa.regimen_jornada || baseRules.regime,
    exceptionalAuthorized:
      empresa.autorizacion_excepcional === null || empresa.autorizacion_excepcional === undefined
        ? baseRules.exceptionalAuthorized
        : Boolean(empresa.autorizacion_excepcional),
    exceptionalReference:
      empresa.referencia_autorizacion || baseRules.exceptionalReference || '',
  };

  const contractDefault = Number(rules.maxWeeklyHours) || 42;
  const shifts = puestos.map((puesto, index) => {
    const start = normalizeTime(puesto.hora_inicio, '08:00');
    const end = normalizeTime(puesto.hora_fin, '16:00');
    const breakMinutes =
      numberOrNull(puesto.minutos_colacion) ?? (puesto.requiere_colacion === false ? 0 : 60);
    const coverage = normalizeCoverage(
      puesto.cobertura_semanal || puesto.plantilla_cobertura,
      puesto.minima_cobertura || 1
    );
    const certifications =
      normalizeCertifications(puesto.certificaciones_requeridas).map((item) => item.name).length
        ? normalizeCertifications(puesto.certificaciones_requeridas).map((item) => item.name)
        : normalizeCertifications(puesto.plantilla_certificaciones).map((item) => item.name);

    return {
      id: puesto.id,
      dbPuestoId: puesto.id,
      name: puesto.plantilla_nombre || puesto.nombre || `Puesto ${index + 1}`,
      code: puesto.plantilla_codigo || puesto.codigo || `P${index + 1}`,
      start,
      end,
      breakMinutes: Math.max(0, Number(breakMinutes) || 0),
      color: puesto.plantilla_color || PALETTE[index % PALETTE.length],
      night: Boolean(puesto.es_nocturno),
      coverage,
      requiredCertifications: certifications,
    };
  });

  const employees = guardias
    .filter((guardia) => guardia.activo !== false)
    .map((guardia, index) => ({
      id: guardia.id,
      name: guardia.nombre_completo,
      role: guardia.cargo || 'Trabajador',
      weeklyContractHours: numberOrNull(guardia.horas_semanales_max) || contractDefault,
      active: true,
      certifications: normalizeCertifications(guardia.certificaciones || guardia.certification),
      unavailableWeekdays: [],
      preferredShiftIds: [],
      color: PALETTE[index % PALETTE.length],
      phone: guardia.telefono || '',
      startDate: guardia.fecha_contrato || startDate,
    }));

  return {
    id: `db-${empresa.id || 'empresa'}-${startDate}`,
    name: name || `${cliente?.nombre || empresa.razon_social || 'Empresa'} · ${sucursal?.nombre || 'Operación'}`,
    company: cliente?.razon_social || cliente?.nombre || empresa.razon_social || 'Empresa',
    location: sucursal ? [sucursal.nombre, sucursal.ciudad].filter(Boolean).join(', ') : '',
    sector,
    startDate,
    days: Number(days) || 28,
    employees,
    shifts,
    rules,
    holidays: [],
    regions: [],
    schedule: null,
    pattern: enginePreset.pattern,
    continuityBias: enginePreset.continuityBias,
    notes: notes || empresa.notas || '',
    createdAt: new Date().toISOString(),
    source: 'database',
    empresaId: empresa.id || null,
    clienteId: cliente?.id || null,
    clientId: cliente?.id || null,
    clientName: cliente?.nombre || null,
    operatorName: empresa.razon_social || null,
    sucursalId: sucursal?.id || null,
  };
}

/** Genera y valida en una sola llamada. */
async function plan(scenario, options = {}) {
  const shared = await loadShared();
  if (!scenario || typeof scenario !== 'object') {
    throw new Error('Se requiere un escenario para generar el horario.');
  }
  const configFindings = shared.validate.validateScenarioConfig(scenario);
  const schedule = shared.engine.generateSchedule(scenario, {
    patternAttempts: Number(options.patternAttempts) || 90,
    greedyAttempts: Number(options.greedyAttempts) || 60,
  });
  const validation = shared.validate.validateSchedule(scenario, schedule);
  return {
    schedule,
    validation,
    configFindings,
    scenario: { ...scenario, schedule },
  };
}

/** Crea un escenario a partir de un preset demo o de datos explícitos. */
async function scenarioFromRequest(body = {}) {
  const shared = await loadShared();
  if (body.scenario && typeof body.scenario === 'object') {
    const scenario = clone(body.scenario);
    const sector = scenario.sector || body.sector || 'seguridad';
    return {
      ...scenario,
      id: scenario.id || `api-${sector}-${scenario.startDate || Date.now()}`,
      sector,
      rules: { ...shared.presets.getSectorRules(sector), ...(scenario.rules || {}) },
      shifts:
        Array.isArray(scenario.shifts) && scenario.shifts.length
          ? scenario.shifts
          : shared.presets.getSectorShifts(sector),
      employees: Array.isArray(scenario.employees) ? scenario.employees : [],
      days: Number(scenario.days) || 28,
      startDate: scenario.startDate || shared.demo.DEMO_START_DATE,
      holidays: scenario.holidays || [],
      regions: scenario.regions || [],
    };
  }

  const sector = body.sector || 'seguridad';
  const demo = shared.demo.createDemoScenarios().find((item) => item.sector === sector);
  if (!demo) {
    throw new Error(`Sector desconocido: ${sector}.`);
  }
  const scenario = clone(demo);
  return {
    ...scenario,
    id: body.id || scenario.id,
    name: body.name || scenario.name,
    company: body.company || scenario.company,
    location: body.location || scenario.location,
    startDate: body.startDate || scenario.startDate,
    days: Number(body.days) || scenario.days,
    notes: body.notes || scenario.notes,
    employees: Array.isArray(body.employees) ? body.employees : scenario.employees,
    shifts: Array.isArray(body.shifts) && body.shifts.length ? body.shifts : scenario.shifts,
    rules: { ...scenario.rules, ...(body.rules || {}) },
    holidays: body.holidays || scenario.holidays || [],
    regions: body.regions || scenario.regions || [],
    schedule: null,
  };
}

/** Devuelve catálogos legales y presets para clientes o integraciones. */
async function getPresets() {
  const shared = await loadShared();
  return {
    app: shared.legal.APP_NAME,
    legalVersion: shared.legal.LEGAL_VERSION,
    disclaimer: shared.legal.DISCLAIMER,
    milestones: shared.legal.WEEKLY_HOURS_MILESTONES,
    sectors: Object.values(shared.legal.SECTOR_META).map((sector) => ({
      ...sector,
      engine: shared.presets.SECTOR_ENGINE_PRESETS[sector.id],
      shifts: shared.presets.getSectorShifts(sector.id),
      rules: shared.presets.getSectorRules(sector.id),
    })),
    demos: shared.demo.createDemoScenarios(),
  };
}

async function getLegalCatalog() {
  const shared = await loadShared();
  return {
    app: shared.legal.APP_NAME,
    version: shared.legal.LEGAL_VERSION,
    disclaimer: shared.legal.DISCLAIMER,
    milestones: shared.legal.WEEKLY_HOURS_MILESTONES,
    sources: shared.legal.LEGAL_SOURCES,
    rules: shared.legal.RULE_CATALOG,
    sectors: shared.legal.SECTOR_META,
  };
}

/**
 * Convierte las asignaciones del horario en filas para la tabla `horarios`.
 * Solo es posible cuando los turnos provienen de puestos de la base de datos.
 */
async function assignmentsToRows(scenario, schedule, { escenarioId = null } = {}) {
  const shared = await loadShared();
  const rows = [];
  if (!schedule || !schedule.cells) return rows;

  const shiftMap = new Map((scenario.shifts || []).map((shift) => [shift.id, shift]));
  const employeeMap = new Map((scenario.employees || []).map((employee) => [employee.id, employee]));
  const holidayMap = shared.holidays.getHolidayMap(scenario.startDate, scenario.days, {
    custom: scenario.holidays || [],
    regions: scenario.regions || [],
  });

  for (const [employeeId, cells] of Object.entries(schedule.cells)) {
    for (const [date, cell] of Object.entries(cells || {})) {
      const fraction =
        cell?.type === 'shift'
          ? 1
          : cell?.type === 'absence' && cell.portion === 'half'
            ? 0.5
            : 0;
      if (!fraction) continue;
      const shift = shiftMap.get(cell.shiftId);
      const employee = employeeMap.get(employeeId);
      if (!shift || !employee || !shift.dbPuestoId) continue;
      const weekday = shared.dates.weekdayISO(date);
      const holiday = holidayMap[date];
      rows.push({
        escenario_id: escenarioId,
        guardia_id: employeeId,
        puesto_id: shift.dbPuestoId,
        fecha: date,
        hora_inicio: shared.dates.shiftStartDate(date, shift),
        hora_fin: shared.dates.shiftEndDate(date, shift),
        horas_trabajadas: Number((shared.dates.shiftLegalHours(shift) * fraction).toFixed(2)),
        tipo_turno: holiday ? 'festivo' : weekday === 7 ? 'domingo' : shift.night ? 'nocturno' : 'ordinario',
        estado: fraction < 1 ? 'ausencia-parcial' : 'borrador',
      });
    }
  }

  return rows;
}

module.exports = {
  loadShared,
  buildScenarioFromDb,
  scenarioFromRequest,
  assignmentsToRows,
  plan,
  getPresets,
  getLegalCatalog,
  PALETTE,
};
