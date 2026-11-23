export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const RUT_RE = /^\d{6,8}-[0-9kK]$/;

export function normalizeRut(value) {
  return String(value || '').replace(/\./g, '').replace(/\s/g, '').toUpperCase();
}

export function dateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

export function timeInput(value) {
  return value ? String(value).slice(0, 5) : '';
}
