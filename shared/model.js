import { shiftLegalHours, weekdayISO } from './dates.js';

export function getActiveEmployees(scenario) {
  return (scenario.employees || []).filter((employee) => employee.active !== false);
}

export function getShiftMap(scenario) {
  return new Map((scenario.shifts || []).map((shift) => [shift.id, shift]));
}

export function getEmployeeMap(scenario) {
  return new Map((scenario.employees || []).map((employee) => [employee.id, employee]));
}

/** Tope diario aplicable. Un régimen excepcional solo habilita 12 h si está autorizado. */
export function getAllowedDailyHours(rules) {
  if (rules.regime === 'excepcional' && rules.exceptionalAuthorized) {
    return Number(rules.maxExceptionalDailyHours) || 12;
  }
  return Number(rules.maxDailyHours) || 10;
}

export function getOrdinaryWeeklyLimit(rules) {
  return Number(rules.maxWeeklyHours) || 42;
}

export function getExceptionalAverageLimit(rules) {
  return Number(rules.maxExceptionalAverageWeeklyHours) || getOrdinaryWeeklyLimit(rules);
}

/**
 * Dotación requerida por turno para una fecha, descontando los días en que
 * la actividad no está autorizada a operar.
 * @returns {{shift: object, required: number}[]}
 */
export function getEffectiveCoverage(scenario, dateISO, holidayMap = {}) {
  const rules = scenario.rules;
  const weekday = weekdayISO(dateISO);
  const isSunday = weekday === 7;
  const isHoliday = Boolean(holidayMap[dateISO]);

  return (scenario.shifts || []).map((shift) => {
    let required = Number(shift.coverage?.[weekday - 1] || 0);
    if (isSunday && !rules.allowSundayWork) required = 0;
    if (isHoliday && !rules.allowHolidayWork) required = 0;
    return { shift, required: Math.max(0, required) };
  });
}

export function getTotalRequiredSlots(scenario, dateISO, holidayMap = {}) {
  return getEffectiveCoverage(scenario, dateISO, holidayMap)
    .reduce((total, item) => total + item.required, 0);
}

export function shiftRespectsDailyLimit(shift, rules) {
  return shiftLegalHours(shift) <= getAllowedDailyHours(rules) + 0.001;
}

export function hasCertification(employee, certificationName, dateISO, requireCertifications = true) {
  if (!requireCertifications || !certificationName) return true;
  const certification = (employee.certifications || []).find(
    (item) => item.name.toLowerCase() === certificationName.toLowerCase()
  );
  if (!certification) return false;
  if (!certification.expiresAt) return true;
  return certification.expiresAt >= dateISO;
}

export function shiftCertificationsOk(employee, shift, dateISO, requireCertifications = true) {
  return (shift.requiredCertifications || []).every((name) =>
    hasCertification(employee, name, dateISO, requireCertifications)
  );
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/** Huella de la configuración para detectar horarios desactualizados. */
export function buildConfigFingerprint(scenario) {
  const employees = getActiveEmployees(scenario)
    .map((employee) => ({
      id: employee.id,
      role: employee.role,
      contract: employee.weeklyContractHours,
      certifications: (employee.certifications || [])
        .map((cert) => ({ name: cert.name, expiresAt: cert.expiresAt || '' }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      unavailableWeekdays: [...(employee.unavailableWeekdays || [])].sort(),
      preferredShiftIds: [...(employee.preferredShiftIds || [])].sort(),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const payload = {
    startDate: scenario.startDate,
    days: scenario.days,
    rules: scenario.rules,
    shifts: (scenario.shifts || []).map((shift) => ({
      id: shift.id,
      start: shift.start,
      end: shift.end,
      breakMinutes: shift.breakMinutes,
      coverage: shift.coverage,
      requiredCertifications: shift.requiredCertifications,
      night: shift.night,
    })),
    employees,
    holidays: scenario.holidays || [],
    regions: scenario.regions || [],
  };

  return hashString(JSON.stringify(payload));
}

export function isScheduleStale(scenario) {
  if (!scenario.schedule) return true;
  return scenario.schedule.meta?.fingerprint !== buildConfigFingerprint(scenario);
}
