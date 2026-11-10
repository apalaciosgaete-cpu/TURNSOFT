/**
 * Utilidades de fecha y turnos para TURNSOFT.
 * Se usan fechas ISO (YYYY-MM-DD) y días ISO (1 = lunes ... 7 = domingo).
 */

export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function pad2(value) {
  return String(value).padStart(2, '0');
}

export function parseISO(iso) {
  if (!iso || typeof iso !== 'string') return new Date(NaN);
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function toISO(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayISO() {
  return toISO(new Date());
}

export function addDays(iso, days) {
  const date = parseISO(iso);
  date.setDate(date.getDate() + days);
  return toISO(date);
}

export function diffDays(fromISO, toISOValue) {
  const from = parseISO(fromISO);
  const to = parseISO(toISOValue);
  const fromUTC = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUTC = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toUTC - fromUTC) / 86400000);
}

/** Día ISO: 1 = lunes, 7 = domingo. */
export function weekdayISO(iso) {
  const day = parseISO(iso).getDay();
  return day === 0 ? 7 : day;
}

export function startOfWeek(iso) {
  return addDays(iso, -(weekdayISO(iso) - 1));
}

export function eachDate(startISO, days) {
  return Array.from({ length: Math.max(0, days) }, (_, index) => addDays(startISO, index));
}

export function datesBetween(startISO, endISO) {
  const total = diffDays(startISO, endISO);
  if (total < 0) return [];
  return eachDate(startISO, total + 1);
}

export function isoWeekKey(iso) {
  const date = parseISO(iso);
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${pad2(week)}`;
}

export function monthKey(iso) {
  return iso.slice(0, 7);
}

export function monthLabel(iso, { short = false } = {}) {
  const date = parseISO(iso);
  const month = MONTHS[date.getMonth()];
  return short ? month.slice(0, 3) : `${month.charAt(0).toUpperCase()}${month.slice(1)} ${date.getFullYear()}`;
}

export function formatDateLong(iso) {
  const date = parseISO(iso);
  return `${WEEKDAYS[weekdayISO(iso) - 1].toLowerCase()} ${date.getDate()} de ${MONTHS[date.getMonth()]} de ${date.getFullYear()}`;
}

export function formatDateShort(iso) {
  const date = parseISO(iso);
  return `${WEEKDAYS_SHORT[weekdayISO(iso) - 1]} ${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)}`;
}

export function formatDayNumber(iso) {
  return String(parseISO(iso).getDate());
}

export function formatRange(startISO, days) {
  const endISO = addDays(startISO, Math.max(0, days - 1));
  const start = parseISO(startISO);
  const end = parseISO(endISO);
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()}–${end.getDate()} de ${MONTHS[start.getMonth()]} ${start.getFullYear()}`;
  }
  return `${start.getDate()} ${MONTHS[start.getMonth()].slice(0, 3)} – ${end.getDate()} ${MONTHS[end.getMonth()].slice(0, 3)} ${end.getFullYear()}`;
}

export function timeToMinutes(time) {
  if (!time || typeof time !== 'string') return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function minutesToTime(minutes) {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(normalized / 60))}:${pad2(normalized % 60)}`;
}

/** Duración total presencia del turno, en minutos (puede cruzar medianoche). */
export function shiftSpanMinutes(shift) {
  const start = timeToMinutes(shift.start);
  const end = timeToMinutes(shift.end);
  const span = end <= start ? end + 1440 - start : end - start;
  return span || 1440;
}

/** Jornada computable: presencia menos colación. */
export function shiftLegalMinutes(shift) {
  return Math.max(0, shiftSpanMinutes(shift) - Math.max(0, Number(shift.breakMinutes) || 0));
}

export function shiftLegalHours(shift) {
  return shiftLegalMinutes(shift) / 60;
}

export function shiftSpanHours(shift) {
  return shiftSpanMinutes(shift) / 60;
}

export function isOvernight(shift) {
  return timeToMinutes(shift.end) <= timeToMinutes(shift.start);
}

export function shiftStartDate(dateISO, shift) {
  const date = parseISO(dateISO);
  const minutes = timeToMinutes(shift.start);
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
}

export function shiftEndDate(dateISO, shift) {
  const start = shiftStartDate(dateISO, shift);
  return new Date(start.getTime() + shiftSpanMinutes(shift) * 60000);
}

export function formatHours(hours) {
  if (!Number.isFinite(hours)) return '0 h';
  const rounded = Math.round(hours * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1).replace('.', ',')} h`;
}

export function formatPercent(value) {
  if (!Number.isFinite(value)) return '0%';
  return `${Math.round(value)}%`;
}

export function formatDateTime(date) {
  return date.toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function uid(prefix = 'id') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function sortByDate(a, b) {
  return a.localeCompare(b);
}
