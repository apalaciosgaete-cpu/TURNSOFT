import {
  addDays,
  diffDays,
  eachDate,
  isoWeekKey,
  shiftEndDate,
  shiftLegalHours,
  shiftStartDate,
  startOfWeek,
  uid,
  weekdayISO,
} from './dates.js';
import { getHolidayMap } from './holidays.js';
import {
  buildConfigFingerprint,
  getActiveEmployees,
  getAllowedDailyHours,
  getEffectiveCoverage,
  getExceptionalAverageLimit,
  getOrdinaryWeeklyLimit,
  getTotalRequiredSlots,
  shiftCertificationsOk,
  shiftRespectsDailyLimit,
} from './model.js';

function hashSeed(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return function random() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, rng) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function createEmptyCells(employees, dates) {
  const cells = {};
  for (const employee of employees) {
    cells[employee.id] = {};
    for (const date of dates) cells[employee.id][date] = { type: 'off' };
  }
  return cells;
}

function newEmployeeState() {
  return {
    lastEnd: null,
    lastDate: null,
    lastShiftId: null,
    lastShiftNight: false,
    nightStreak: 0,
    nightCount: 0,
    workStreak: 0,
    forcedRest: 0,
    hours: 0,
    workDays: 0,
    totalOffDays: 0,
    sundayOffCount: 0,
    weekHours: {},
    weekDays: {},
  };
}

function buildSlots(scenario, date, holidayMap) {
  const slots = [];
  for (const item of getEffectiveCoverage(scenario, date, holidayMap)) {
    for (let count = 0; count < item.required; count += 1) slots.push(item.shift);
  }
  return slots;
}

function slotSignature(slots) {
  return slots.map((shift) => shift.id).sort().join('|');
}

function isEligibleForShift(employee, shift, date, scenario, state, options = {}) {
  const rules = scenario.rules;
  const weekday = weekdayISO(date);

  if ((employee.unavailableWeekdays || []).includes(weekday)) return false;
  if (!shiftRespectsDailyLimit(shift, rules)) return false;
  if (!shiftCertificationsOk(employee, shift, date, rules.requireCertifications)) return false;

  if (state.lastEnd) {
    const restHours = (shiftStartDate(date, shift).getTime() - state.lastEnd.getTime()) / 3600000;
    if (restHours < (Number(rules.minRestBetweenShifts) || 0) - 0.02) return false;
  }

  if (rules.regime === 'ordinaria') {
    const weekKey = isoWeekKey(date);
    const weekly = state.weekHours[weekKey] || 0;
    if (weekly + shiftLegalHours(shift) > getOrdinaryWeeklyLimit(rules) + 0.001) return false;
    const weekDays = state.weekDays[weekKey] || 0;
    if (weekDays + 1 > (Number(rules.maxDaysPerWeek) || 6)) return false;
  }

  if (options.enforceConsecutive) {
    if (state.workStreak >= (Number(rules.maxConsecutiveWorkDays) || 6)) return false;
  }

  if (shift.night) {
    if (state.nightStreak >= (Number(rules.maxConsecutiveNightShifts) || 6)) return false;
  }

  if (options.maxTotalHours && state.hours + shiftLegalHours(shift) > options.maxTotalHours + 0.001) return false;

  return true;
}

function candidateScore(employee, shift, state, scenario, rng, date) {
  const continuity = Number(scenario.continuityBias) || 1;
  let score = rng() * 6;
  if (state.lastDate === addDays(date, -1)) {
    if (state.lastShiftId === shift.id) score -= 60 * continuity;
    score -= 2 * continuity;
  }
  if ((employee.preferredShiftIds || []).includes(shift.id)) score -= 5;
  if (shift.night) score += state.nightCount * 0.8;
  score += state.hours * 0.01;
  return score;
}

/**
 * Encuentra una asignación perfecta empleados -> cupos para un día.
 * Se usa backtracking porque los turnos nocturnos y los descansos reducen
 * mucho las combinaciones válidas.
 */
function findDayAssignment(workingEmployees, slots, scenario, date, stateMap, rng) {
  const candidateSlots = slots.map((shift) => ({
    shift,
    candidates: workingEmployees.filter((employee) =>
      isEligibleForShift(employee, shift, date, scenario, stateMap[employee.id], { enforceConsecutive: true })
    ),
  }));

  candidateSlots.sort((a, b) => {
    if (a.candidates.length !== b.candidates.length) return a.candidates.length - b.candidates.length;
    return Number(b.shift.night) - Number(a.shift.night);
  });

  if (candidateSlots.some((slot) => slot.candidates.length === 0)) return null;

  const used = new Set();
  const assignment = new Map();

  function search(index) {
    if (index === candidateSlots.length) return true;
    const { shift, candidates } = candidateSlots[index];
    const options = candidates
      .filter((employee) => !used.has(employee.id))
      .sort((a, b) =>
        candidateScore(a, shift, stateMap[a.id], scenario, rng, date) -
        candidateScore(b, shift, stateMap[b.id], scenario, rng, date)
      );

    for (const employee of options) {
      used.add(employee.id);
      assignment.set(employee.id, shift);
      if (search(index + 1)) return true;
      used.delete(employee.id);
      assignment.delete(employee.id);
    }
    return false;
  }

  return search(0) ? assignment : null;
}

function applyWorkingState(state, employee, shift, date, limits = {}) {
  const legalHours = shiftLegalHours(shift);
  const weekKey = isoWeekKey(date);
  state.nightStreak = shift.night ? state.nightStreak + 1 : 0;
  state.nightCount += shift.night ? 1 : 0;
  state.workStreak += 1;
  state.hours += legalHours;
  state.workDays += 1;
  state.weekHours[weekKey] = (state.weekHours[weekKey] || 0) + legalHours;
  state.weekDays[weekKey] = (state.weekDays[weekKey] || 0) + 1;
  state.lastEnd = shiftEndDate(date, shift);
  state.lastDate = date;
  state.lastShiftId = shift.id;
  state.lastShiftNight = shift.night;

  const maxConsecutive = Number(limits.maxConsecutive) || 0;
  if (maxConsecutive > 0 && state.workStreak >= maxConsecutive) {
    state.forcedRest = Number(limits.blockRest) || 0;
  }
}

function applyOffState(state, date) {
  state.nightStreak = 0;
  state.workStreak = 0;
  state.lastShiftId = null;
  state.lastShiftNight = false;
  state.totalOffDays += 1;
  if (weekdayISO(date) === 7) state.sundayOffCount += 1;
}

function buildOffPlan(scenario, dates, employees, holidayMap, rng) {
  const totals = {};
  const sundays = {};
  const weekOff = {};
  for (const employee of employees) {
    totals[employee.id] = 0;
    sundays[employee.id] = 0;
  }

  const offByDate = new Map();
  const firstWeekStart = startOfWeek(dates[0]);

  for (const date of dates) {
    const weekday = weekdayISO(date);
    const dayIndex = weekday - 1;
    const weekStart = startOfWeek(date);
    const weekIndex = Math.round(diffDays(firstWeekStart, weekStart) / 7);
    const offset = ((weekIndex % 4) + 4) % 4;
    const weekKey = isoWeekKey(date);
    if (!weekOff[weekKey]) weekOff[weekKey] = {};

    const base = employees.filter((employee, index) => {
      const shifted = (index + offset) % 7;
      return shifted === dayIndex || (shifted + 1) % 7 === dayIndex;
    });

    const required = getTotalRequiredSlots(scenario, date, holidayMap);
    const targetOff = Math.max(0, Math.min(employees.length, employees.length - required));
    let off = [...base];

    if (targetOff < base.length) {
      off = [...base]
        .sort((a, b) => totals[b.id] - totals[a.id] || rng() - 0.5)
        .slice(0, targetOff);
    } else if (targetOff > base.length) {
      const baseIds = new Set(base.map((employee) => employee.id));
      const extras = employees
        .filter((employee) => !baseIds.has(employee.id))
        .sort((a, b) => {
          if (weekday === 7) {
            return sundays[a.id] - sundays[b.id] || totals[a.id] - totals[b.id] || rng() - 0.5;
          }
          const weekA = weekOff[weekKey][a.id] || 0;
          const weekB = weekOff[weekKey][b.id] || 0;
          return weekA - weekB || totals[a.id] - totals[b.id] || rng() - 0.5;
        });
      off = [...base, ...extras.slice(0, targetOff - base.length)];
    }

    for (const employee of off) {
      totals[employee.id] += 1;
      weekOff[weekKey][employee.id] = (weekOff[weekKey][employee.id] || 0) + 1;
      if (weekday === 7) sundays[employee.id] += 1;
    }
    offByDate.set(date, new Set(off.map((employee) => employee.id)));
  }

  return offByDate;
}

function tryPatternSchedule(scenario, dates, workers, holidayMap, seed) {
  const rng = mulberry32(seed);
  const ordered = shuffle(workers, rng);
  const cells = createEmptyCells(workers, dates);
  const stateMap = Object.fromEntries(workers.map((employee) => [employee.id, newEmployeeState()]));
  const offByDate = buildOffPlan(scenario, dates, ordered, holidayMap, rng);

  for (const date of dates) {
    const off = offByDate.get(date);
    const working = workers.filter((employee) => !off.has(employee.id));
    const slots = buildSlots(scenario, date, holidayMap);
    if (working.length !== slots.length) return null;

    const assignment = findDayAssignment(working, slots, scenario, date, stateMap, rng);
    if (!assignment || assignment.size !== working.length) return null;

    for (const employee of workers) {
      if (off.has(employee.id)) {
        cells[employee.id][date] = { type: 'off' };
        applyOffState(stateMap[employee.id], date);
      } else {
        const shift = assignment.get(employee.id);
        if (!shift) return null;
        cells[employee.id][date] = { type: 'shift', shiftId: shift.id };
        applyWorkingState(stateMap[employee.id], employee, shift, date);
      }
    }
  }

  return cells;
}

function findCrewAssignment(crew, slots, blockIndex) {
  const rotated = [...crew.slice(blockIndex % Math.max(1, crew.length)), ...crew.slice(0, blockIndex % Math.max(1, crew.length))];
  const candidateSlots = slots.map((shift) => ({
    shift,
    candidates: rotated.filter((employee) =>
      (shift.requiredCertifications || []).every((name) => {
        const certification = (employee.certifications || []).find((item) => item.name === name);
        return certification && (!certification.expiresAt || certification.expiresAt >= '2026-01-01');
      })
    ),
  }));

  candidateSlots.sort((a, b) => a.candidates.length - b.candidates.length);
  if (candidateSlots.some((slot) => slot.candidates.length === 0)) return null;

  const used = new Set();
  const assignment = new Map();
  function search(index) {
    if (index === candidateSlots.length) return true;
    const { shift, candidates } = candidateSlots[index];
    const order = candidates.filter((employee) => !used.has(employee.id));
    for (const employee of order) {
      used.add(employee.id);
      assignment.set(employee.id, shift);
      if (search(index + 1)) return true;
      used.delete(employee.id);
      assignment.delete(employee.id);
    }
    return false;
  }
  return search(0) ? assignment : null;
}

function canUseCrewPattern(scenario, dates, workers, holidayMap) {
  const rules = scenario.rules;
  if (rules.regime !== 'excepcional' || !rules.exceptionalAuthorized) return null;
  if (workers.length < 2 || workers.some((employee) => (employee.unavailableWeekdays || []).length > 0)) return null;
  if (Number(rules.maxConsecutiveWorkDays) !== Number(rules.blockRestDays)) return null;
  if ((scenario.pattern !== '4x4' && scenario.pattern !== '7x7') && Number(rules.maxConsecutiveWorkDays) > 4) return null;

  const dailySlots = dates.map((date) => buildSlots(scenario, date, holidayMap));
  const signature = slotSignature(dailySlots[0]);
  if (!signature) return null;
  if (dailySlots.some((slots) => slotSignature(slots) !== signature)) return null;

  const slots = dailySlots[0];
  if (workers.length !== slots.length * 2) return null;
  if (slots.some((shift) => !shiftRespectsDailyLimit(shift, rules))) return null;
  if (slots.some((shift) => shift.night) && Number(rules.maxConsecutiveWorkDays) > (Number(rules.maxConsecutiveNightShifts) || 6)) return null;
  if (dates.length < Number(rules.maxConsecutiveWorkDays) + Number(rules.blockRestDays)) return null;

  return { slots, block: Number(rules.maxConsecutiveWorkDays), rest: Number(rules.blockRestDays) };
}

function tryCrewSchedule(scenario, dates, workers, holidayMap, crewConfig) {
  const { slots, block, rest } = crewConfig;
  const cycle = block + rest;
  const cells = createEmptyCells(workers, dates);
  const crewA = workers.slice(0, slots.length);
  const crewB = workers.slice(slots.length, slots.length * 2);

  let crewADays = 0;
  let crewBDays = 0;

  for (let index = 0; index < dates.length; index += 1) {
    const date = dates[index];
    const position = index % cycle;
    const workingCrew = position < block ? crewA : crewB;
    if (workingCrew === crewA) crewADays += 1;
    else crewBDays += 1;
    const workingSet = new Set(workingCrew.map((employee) => employee.id));
    const blockIndex = Math.floor(index / cycle);
    const assignment = findCrewAssignment(workingCrew, slots, blockIndex);

    if (!assignment || assignment.size !== slots.length) return null;

    for (const employee of workers) {
      if (workingSet.has(employee.id)) {
        const shift = assignment.get(employee.id);
        cells[employee.id][date] = shift ? { type: 'shift', shiftId: shift.id } : { type: 'off' };
      } else {
        cells[employee.id][date] = { type: 'off' };
      }
    }
  }

  // Si el período deja un bloque extra a una cuadrilla, se reparte el primer
  // bloque entre ambas para equilibrar las horas sin perder cobertura. La
  // cuadrilla que entra primero descansa lo que reste del bloque antes de su
  // siguiente turno, por lo que no se superan los días consecutivos.
  const difference = crewADays - crewBDays;
  const splitDays = Math.min(block - 1, Math.floor(Math.abs(difference) / 2));
  if (splitDays > 0) {
    const overCrew = difference > 0 ? crewA : crewB;
    const underCrew = difference > 0 ? crewB : crewA;
    for (let index = 0; index < block; index += 1) {
      const date = dates[index];
      const workingCrew = index < splitDays ? underCrew : overCrew;
      const workingSet = new Set(workingCrew.map((employee) => employee.id));
      const assignment = findCrewAssignment(workingCrew, slots, 0);
      if (!assignment || assignment.size !== slots.length) return null;
      for (const employee of workers) {
        const shift = workingSet.has(employee.id) ? assignment.get(employee.id) : null;
        cells[employee.id][date] = shift
          ? { type: 'shift', shiftId: shift.id }
          : { type: 'off' };
      }
    }
  }

  return cells;
}

function tryGreedySchedule(scenario, dates, workers, holidayMap, seed) {
  const rng = mulberry32(seed);
  const cells = createEmptyCells(workers, dates);
  const stateMap = Object.fromEntries(
    workers.map((employee) => [
      employee.id,
      {
        ...newEmployeeState(),
        __maxConsecutive: Number(scenario.rules.maxConsecutiveWorkDays) || 6,
        __blockRest: Number(scenario.rules.blockRestDays) || 1,
      },
    ])
  );
  const exceptional = scenario.rules.regime === 'excepcional' && scenario.rules.exceptionalAuthorized;
  const maxTotalHours = exceptional
    ? getExceptionalAverageLimit(scenario.rules) * (dates.length / 7)
    : Infinity;

  for (const date of dates) {
    const slots = buildSlots(scenario, date, holidayMap);
    const assignedToday = new Set();
    const forcedAtStart = new Set();

    for (const employee of workers) {
      const state = stateMap[employee.id];
      if (state.forcedRest > 0) forcedAtStart.add(employee.id);
    }

    for (const shift of slots) {
      const candidates = workers.filter((employee) => {
        if (assignedToday.has(employee.id)) return false;
        const state = stateMap[employee.id];
        if (state.forcedRest > 0) return false;
        return isEligibleForShift(employee, shift, date, scenario, state, {
          enforceConsecutive: true,
          maxTotalHours,
        });
      });

      if (candidates.length === 0) continue;

      candidates.sort((a, b) =>
        candidateScore(a, shift, stateMap[a.id], scenario, rng, date) -
        candidateScore(b, shift, stateMap[b.id], scenario, rng, date)
      );
      const employee = candidates[0];
      assignedToday.add(employee.id);
      cells[employee.id][date] = { type: 'shift', shiftId: shift.id };
      applyWorkingState(stateMap[employee.id], employee, shift, date, {
        maxConsecutive: Number(scenario.rules.maxConsecutiveWorkDays) || 6,
        blockRest: Number(scenario.rules.blockRestDays) || 1,
      });
    }

    for (const employee of workers) {
      if (assignedToday.has(employee.id)) continue;
      cells[employee.id][date] = { type: 'off' };
      applyOffState(stateMap[employee.id], date);
    }

    for (const employee of workers) {
      const state = stateMap[employee.id];
      if (state.forcedRest > 0 && !assignedToday.has(employee.id) && forcedAtStart.has(employee.id)) {
        state.forcedRest -= 1;
      }
    }
  }

  return cells;
}

/** Evita aceptar una cuadrilla si algún trabajador supera el promedio excepcional del período. */
function exceedsExceptionalAverage(cells, scenario, dates, workers) {
  const rules = scenario.rules || {};
  if (rules.regime !== 'excepcional' || !rules.exceptionalAuthorized) return false;
  const limit = getExceptionalAverageLimit(rules) * (dates.length / 7) + 0.001;
  const shiftMap = new Map((scenario.shifts || []).map((shift) => [shift.id, shift]));
  return workers.some((employee) => {
    let total = 0;
    for (const date of dates) {
      const cell = cells[employee.id]?.[date];
      if (cell?.type === 'shift') {
        const shift = shiftMap.get(cell.shiftId);
        if (shift) total += shiftLegalHours(shift);
      }
    }
    return total > limit;
  });
}

function evaluateCells(cells, scenario, dates, workers, holidayMap) {
  let required = 0;
  let filled = 0;
  let sundayPenalty = 0;
  let spread = 0;
  const hours = [];

  for (const date of dates) {
    for (const item of getEffectiveCoverage(scenario, date, holidayMap)) {
      required += item.required;
      for (const employee of workers) {
        if (cells[employee.id]?.[date]?.shiftId === item.shift.id) filled += 1;
      }
    }
  }

  const sundays = dates.filter((date) => weekdayISO(date) === 7);
  for (const employee of workers) {
    const sundayWorked = sundays.filter((date) => cells[employee.id]?.[date]?.type === 'shift').length;
    const sundayOff = sundays.length - sundayWorked;
    sundayPenalty += Math.max(0, (Number(scenario.rules.minSundaysOffPerMonth) || 0) - sundayOff);

    let totalHours = 0;
    for (const date of dates) {
      if (cells[employee.id]?.[date]?.type === 'shift') {
        const shift = scenario.shifts.find((item) => item.id === cells[employee.id][date].shiftId);
        if (shift) totalHours += shiftLegalHours(shift);
      }
    }
    hours.push(totalHours);
  }

  if (hours.length > 1) {
    const average = hours.reduce((sum, value) => sum + value, 0) / hours.length;
    spread = hours.reduce((sum, value) => sum + Math.abs(value - average), 0) / hours.length;
  }

  const score = filled * 10000 - (required - filled) * 5000 - sundayPenalty * 350 - spread * 20;
  return { required, filled, score, coverage: required ? filled / required : 1 };
}

/**
 * Genera un horario para un escenario.
 * Estrategias: bloques de cuadrilla (4x4/7x7), patrón semanal con 7 personas
 * (5x2 y coberturas variables) y respaldo con búsqueda codiciosa.
 */
export function generateSchedule(scenario, options = {}) {
  const dates = eachDate(scenario.startDate, scenario.days);
  const holidayMap = getHolidayMap(scenario.startDate, scenario.days, {
    custom: scenario.holidays || [],
    regions: scenario.regions || [],
  });
  const workers = getActiveEmployees(scenario);
  const fingerprint = buildConfigFingerprint(scenario);

  let best = {
    cells: createEmptyCells(workers, dates),
    score: -Infinity,
    strategy: 'sin-asignar',
    attempts: 0,
  };

  if (!workers.length || !scenario.shifts?.length || !dates.length) {
    return finalize(best, scenario, dates, workers, holidayMap);
  }

  const crewConfig = canUseCrewPattern(scenario, dates, workers, holidayMap);
  if (crewConfig) {
    const cells = tryCrewSchedule(scenario, dates, workers, holidayMap, crewConfig);
    if (cells) {
      const evaluation = evaluateCells(cells, scenario, dates, workers, holidayMap);
      if (evaluation.coverage >= 0.999 && !exceedsExceptionalAverage(cells, scenario, dates, workers)) {
        return finalize(
          { cells, score: evaluation.score, strategy: scenario.pattern === '7x7' ? 'cuadrillas-7x7' : 'cuadrillas-4x4', attempts: 1 },
          scenario,
          dates,
          workers,
          holidayMap
        );
      }
    }
  }

  const ordinary = scenario.rules.regime === 'ordinaria';
  const allShiftsShort = (scenario.shifts || []).every(
    (shift) => shiftLegalHours(shift) * 5 <= getOrdinaryWeeklyLimit(scenario.rules) + 0.001
  );
  const canPattern =
    ordinary &&
    workers.length === 7 &&
    workers.every((employee) => (employee.unavailableWeekdays || []).length === 0) &&
    allShiftsShort &&
    dates.every((date) => getTotalRequiredSlots(scenario, date, holidayMap) <= 7);

  const patternAttempts = Number(options.patternAttempts) || 70;
  if (canPattern) {
    for (let attempt = 0; attempt < patternAttempts; attempt += 1) {
      const seed = hashSeed(`${scenario.id}|${scenario.startDate}|${scenario.days}|pattern|${attempt}`);
      const cells = tryPatternSchedule(scenario, dates, workers, holidayMap, seed);
      if (!cells) continue;
      const evaluation = evaluateCells(cells, scenario, dates, workers, holidayMap);
      const candidate = {
        cells,
        score: evaluation.score + 500,
        strategy: 'patron-semanal',
        attempts: attempt + 1,
      };
      if (candidate.score > best.score) best = candidate;
      if (evaluation.coverage >= 0.999 && !evaluation.sundayPenalty) break;
    }
  }

  if (best.score < 0 || evaluateCells(best.cells, scenario, dates, workers, holidayMap).coverage < 0.999) {
    const greedyAttempts = Number(options.greedyAttempts) || 80;
    for (let attempt = 0; attempt < greedyAttempts; attempt += 1) {
      const seed = hashSeed(`${scenario.id}|${scenario.startDate}|${scenario.days}|greedy|${attempt}`);
      const cells = tryGreedySchedule(scenario, dates, workers, holidayMap, seed);
      const evaluation = evaluateCells(cells, scenario, dates, workers, holidayMap);
      const candidate = { cells, score: evaluation.score, strategy: 'busqueda-guiada', attempts: attempt + 1 };
      if (candidate.score > best.score) best = candidate;
      if (evaluation.coverage >= 0.999 && !evaluation.sundayPenalty) break;
    }
  }

  return finalize(best, scenario, dates, workers, holidayMap);
}

function finalize(best, scenario, dates, workers, holidayMap) {
  const evaluation = evaluateCells(best.cells, scenario, dates, workers, holidayMap);
  const meta = {
    engine: 'turnsoft-v2',
    generatedAt: new Date().toISOString(),
    strategy: best.strategy,
    attempts: best.attempts,
    fingerprint: buildConfigFingerprint(scenario),
    requiredSlots: evaluation.required,
    filledSlots: evaluation.filled,
    coveragePct: evaluation.required ? (evaluation.filled / evaluation.required) * 100 : 100,
    seed: hashSeed(`${scenario.id}|${scenario.startDate}|${scenario.days}`),
    days: dates.length,
  };

  return {
    id: uid('sch'),
    startDate: scenario.startDate,
    days: scenario.days,
    cells: best.cells,
    meta,
    stats: {
      requiredSlots: evaluation.required,
      filledSlots: evaluation.filled,
      coveragePct: meta.coveragePct,
      strategy: meta.strategy,
    },
  };
}

export { mulberry32, shuffle, createEmptyCells };
