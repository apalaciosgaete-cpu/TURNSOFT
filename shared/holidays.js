import { addDays, eachDate, parseISO, toISO, weekdayISO } from './dates.js';

function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 190);
  const n = Math.floor((h + l - 7 * m + 114) / 31);
  const p = (h + l - 7 * m + 114) % 31;
  return new Date(year, n - 1, p + 1, 12, 0, 0, 0);
}

function movedToMonday(iso) {
  const weekday = weekdayISO(iso);
  if (weekday >= 2 && weekday <= 4) return addDays(iso, -(weekday - 1));
  if (weekday === 5) return addDays(iso, 3);
  return iso;
}

function fixed(year, month, day, name, type = 'national') {
  return { date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, name, type };
}

/**
 * Feriados nacionales de Chile para un año.
 * Incluye feriados fijos, los trasladables de 29-06 y 12-10, y los de Semana Santa.
 */
export function getNationalHolidays(year) {
  const easter = easterSunday(year);
  const goodFriday = new Date(easter.getTime() - 2 * 86400000);
  const holySaturday = new Date(easter.getTime() - 86400000);
  const sanPedro = movedToMonday(`${year}-06-29`);
  const dosMundos = movedToMonday(`${year}-10-12`);

  return [
    fixed(year, 1, 1, 'Año Nuevo'),
    { date: toISO(goodFriday), name: 'Viernes Santo', type: 'national' },
    { date: toISO(holySaturday), name: 'Sábado Santo', type: 'national' },
    fixed(year, 5, 1, 'Día Nacional del Trabajo'),
    fixed(year, 5, 21, 'Día de las Glorias Navales'),
    fixed(year, 6, 21, 'Día Nacional de los Pueblos Indígenas'),
    { date: sanPedro, name: 'San Pedro y San Pablo', type: 'national' },
    fixed(year, 7, 16, 'Virgen del Carmen'),
    fixed(year, 8, 15, 'Asunción de la Virgen'),
    fixed(year, 9, 18, 'Independencia Nacional'),
    fixed(year, 9, 19, 'Glorias del Ejército'),
    { date: dosMundos, name: 'Encuentro de Dos Mundos', type: 'national' },
    fixed(year, 10, 31, 'Día Nacional de las Iglesias Evangélicas y Protestantes'),
    fixed(year, 11, 1, 'Todos los Santos'),
    fixed(year, 12, 8, 'Inmaculada Concepción'),
    fixed(year, 12, 25, 'Navidad'),
  ];
}

/** Feriados regionales que suelen impactar planificaciones locales. */
export const REGIONAL_HOLIDAYS = [
  { region: 'arica', label: 'Arica y Parinacota', date: '06-07', name: 'Asalto y Toma del Morro de Arica' },
  { region: 'nuble', label: 'Ñuble', date: '08-20', name: 'Nacimiento del General Bernardo O\'Higgins' },
];

export function getHolidaysForYears(years) {
  const unique = [...new Set(years)];
  return unique.flatMap((year) => getNationalHolidays(year));
}

/**
 * @param {string} startISO
 * @param {number} days
 * @param {{custom?: string[], regions?: string[]}} options
 * @returns {Record<string, {name: string, type: string, region?: string}>}
 */
export function getHolidayMap(startISO, days, options = {}) {
  const { custom = [], regions = [] } = options;
  const dates = eachDate(startISO, days);
  const years = [...new Set(dates.map((date) => parseISO(date).getFullYear()))];
  const map = {};

  for (const holiday of getHolidaysForYears(years)) {
    map[holiday.date] = { name: holiday.name, type: holiday.type };
  }

  for (const holiday of REGIONAL_HOLIDAYS) {
    if (!regions.includes(holiday.region)) continue;
    for (const year of years) {
      const date = `${year}-${holiday.date}`;
      if (map[date]) continue;
      map[date] = { name: holiday.name, type: 'regional', region: holiday.region };
    }
  }

  for (const date of custom) {
    if (!date) continue;
    map[date] = { name: 'Feriado definido por la empresa', type: 'custom' };
  }

  return map;
}

export function getHolidaysInRange(startISO, days, options = {}) {
  const map = getHolidayMap(startISO, days, options);
  return eachDate(startISO, days)
    .filter((date) => Boolean(map[date]))
    .map((date) => ({ date, ...map[date] }));
}

export function isHoliday(holidayMap, iso) {
  return Boolean(holidayMap[iso]);
}

export function holidayLabel(holidayMap, iso) {
  return holidayMap[iso]?.name || '';
}
