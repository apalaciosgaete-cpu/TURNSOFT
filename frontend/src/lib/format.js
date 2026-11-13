export const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

export function money(value) {
  return CLP.format(Number(value) || 0);
}

export function compactMoney(value) {
  const amount = Number(value) || 0;
  if (Math.abs(amount) >= 1000000) {
    return `$${(amount / 1000000).toLocaleString('es-CL', { maximumFractionDigits: 1 })} MM`;
  }
  if (Math.abs(amount) >= 1000) {
    return `$${(amount / 1000).toLocaleString('es-CL', { maximumFractionDigits: 0 })} mil`;
  }
  return money(amount);
}

const MONTHS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

/** "2026-11" -> "nov 2026" */
export function periodLabel(periodo) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(periodo || ''));
  if (!match) return periodo || '—';
  const month = Number(match[2]) - 1;
  return `${MONTHS[month] || match[2]} ${match[1]}`;
}

export function currentPeriod(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function dateLabel(value, { withTime = false } = {}) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const base = date.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  if (!withTime) return base;
  const time = date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  return `${base} · ${time}`;
}

export function relativeTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `hace ${days} d`;
  return dateLabel(value);
}

/** "1 empresa" / "3 empresas" sin duplicar la lógica en cada vista. */
export function plural(count, singular, pluralForm) {
  return `${count} ${Number(count) === 1 ? singular : pluralForm}`;
}

/**
 * Días calendario restantes de una prueba. El día de inicio muestra 15 y
 * el último día muestra 1, sin desfases por horas o zonas horarias.
 */
export function trialDaysLeft(value) {
  if (!value) return null;
  const end = new Date(value);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  const endDay = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((endDay - todayDay) / 86400000));
}

/** Porcentaje de uso de un límite del plan (null = ilimitado). */
export function usage(value, limit) {
  if (limit === null || limit === undefined) return null;
  if (!limit) return 100;
  return Math.min(100, Math.round((Number(value || 0) / Number(limit)) * 100));
}
