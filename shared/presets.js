import { RULES_PRESET_BASE } from './legal.js';

function shift(id, name, code, start, end, breakMinutes, color, night, coverage, requiredCertifications = []) {
  return {
    id,
    name,
    code,
    start,
    end,
    breakMinutes,
    color,
    night,
    coverage,
    requiredCertifications,
  };
}

const ALL_DAYS = [1, 1, 1, 1, 1, 1, 1];

export const SECTOR_SHIFTS = {
  seguridad: [
    shift('seg-d12', 'Día 12 h', 'D12', '08:00', '20:00', 60, '#0f766e', false, [2, 2, 2, 2, 2, 2, 2], ['OS-10']),
    shift('seg-n12', 'Noche 12 h', 'N12', '20:00', '08:00', 60, '#1e3a8a', true, [2, 2, 2, 2, 2, 2, 2], ['OS-10']),
  ],
  salud: [
    shift('sal-m', 'Mañana', 'M', '07:00', '16:00', 60, '#0284c7', false, [2, 2, 2, 2, 2, 2, 2], ['Registro profesional']),
    shift('sal-t', 'Tarde', 'T', '15:00', '00:00', 60, '#7c3aed', false, [2, 2, 2, 2, 2, 2, 1], ['Registro profesional']),
    shift('sal-n', 'Noche', 'N', '23:00', '08:00', 60, '#334155', true, [1, 1, 1, 1, 1, 1, 1], ['Registro profesional']),
  ],
  mineria: [
    shift('min-d12', 'Día faena', 'FD', '07:00', '19:00', 60, '#b45309', false, [2, 2, 2, 2, 2, 2, 2], ['Seguridad minera']),
    shift('min-n12', 'Noche faena', 'FN', '19:00', '07:00', 60, '#1e293b', true, [2, 2, 2, 2, 2, 2, 2], ['Seguridad minera']),
  ],
  retail: [
    shift('ret-a', 'Apertura', 'A', '09:00', '18:00', 60, '#db2777', false, [3, 3, 3, 3, 3, 3, 2]),
    shift('ret-c', 'Cierre', 'C', '14:00', '23:00', 60, '#9d174d', false, [2, 2, 2, 2, 2, 2, 1]),
  ],
  logistica: [
    shift('log-d', 'Día bodega', 'DB', '08:00', '17:00', 60, '#7c3aed', false, [3, 3, 3, 3, 3, 2, 0]),
    shift('log-t', 'Tarde bodega', 'TB', '16:00', '01:00', 60, '#4f46e5', false, [2, 2, 2, 2, 2, 1, 0]),
  ],
};

export const SECTOR_ENGINE_PRESETS = {
  seguridad: { pattern: '4x4', continuityBias: 5 },
  salud: { pattern: '5x2', continuityBias: 2.5 },
  mineria: { pattern: '7x7', continuityBias: 5 },
  retail: { pattern: '5x2', continuityBias: 1.2 },
  logistica: { pattern: '5x2', continuityBias: 1 },
};

export const SECTOR_RULE_PRESETS = {
  seguridad: {
    ...RULES_PRESET_BASE,
    regime: 'excepcional',
    maxWeeklyHours: 42,
    maxDailyHours: 10,
    maxExceptionalDailyHours: 12,
    maxExceptionalAverageWeeklyHours: 42,
    maxConsecutiveWorkDays: 4,
    blockRestDays: 4,
    minSundaysOffPerMonth: 1,
    allowSundayWork: true,
    allowHolidayWork: true,
    exceptionalAuthorized: true,
    exceptionalReference: 'Res. Ex. 1185/2006 · autorización DT (demo)',
    maxConsecutiveNightShifts: 4,
    requireCertifications: true,
    requireFullCoverage: true,
  },
  salud: {
    ...RULES_PRESET_BASE,
    regime: 'ordinaria',
    maxWeeklyHours: 42,
    maxDailyHours: 8,
    maxConsecutiveWorkDays: 6,
    blockRestDays: 2,
    minSundaysOffPerMonth: 1,
    allowSundayWork: true,
    allowHolidayWork: true,
    maxConsecutiveNightShifts: 6,
    requireCertifications: true,
    requireFullCoverage: true,
  },
  mineria: {
    ...RULES_PRESET_BASE,
    regime: 'excepcional',
    maxWeeklyHours: 42,
    maxDailyHours: 10,
    maxExceptionalDailyHours: 12,
    maxExceptionalAverageWeeklyHours: 42,
    maxConsecutiveWorkDays: 7,
    blockRestDays: 7,
    minSundaysOffPerMonth: 2,
    allowSundayWork: true,
    allowHolidayWork: true,
    exceptionalAuthorized: true,
    exceptionalReference: 'DS 48/2023 · autorización DT (demo)',
    maxConsecutiveNightShifts: 7,
    requireCertifications: true,
    requireFullCoverage: true,
  },
  retail: {
    ...RULES_PRESET_BASE,
    regime: 'ordinaria',
    maxWeeklyHours: 42,
    maxDailyHours: 8,
    maxConsecutiveWorkDays: 6,
    blockRestDays: 2,
    minSundaysOffPerMonth: 2,
    sundayPremiumPercent: 30,
    holidayPremiumPercent: 30,
    allowSundayWork: true,
    allowHolidayWork: true,
    maxConsecutiveNightShifts: 6,
    requireCertifications: false,
    requireFullCoverage: true,
  },
  logistica: {
    ...RULES_PRESET_BASE,
    regime: 'ordinaria',
    maxWeeklyHours: 42,
    maxDailyHours: 8,
    maxConsecutiveWorkDays: 6,
    blockRestDays: 2,
    minSundaysOffPerMonth: 0,
    allowSundayWork: false,
    allowHolidayWork: false,
    maxConsecutiveNightShifts: 6,
    requireCertifications: false,
    requireFullCoverage: true,
  },
};

export function getSectorRules(sectorId) {
  return { ...(SECTOR_RULE_PRESETS[sectorId] || RULES_PRESET_BASE) };
}

export function getSectorShifts(sectorId) {
  return (SECTOR_SHIFTS[sectorId] || SECTOR_SHIFTS.logistica).map((item) => ({
    ...item,
    coverage: [...item.coverage],
    requiredCertifications: [...item.requiredCertifications],
  }));
}
