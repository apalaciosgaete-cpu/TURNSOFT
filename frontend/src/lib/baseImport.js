// Conversión de la base de la empresa (trabajadores y horarios base, guardados en la base
// de datos) a los datos de una planificación. Lo usan la creación de la planificación y los
// botones "Importar" de Dotación y Turnos, para que traigan siempre lo mismo.

const DEFAULT_COVERAGE = [1, 1, 1, 1, 1, 0, 0];
const DEFAULT_COLOR = '#0f766e';

export function workerKey(name, rut) {
  return `${String(name || '').trim().toLowerCase()}|${String(rut || '').replace(/\./g, '').toUpperCase()}`;
}

export function shiftKey(name) {
  return String(name || '').trim().toLowerCase();
}

export function guardiaToEmployee(guardia, { weeklyHours = 42, startDate = '' } = {}) {
  const certifications = [];
  if (guardia.numero_certificado || guardia.fecha_vencimiento) {
    certifications.push({
      id: `os10-${guardia.id}`,
      name: 'OS-10',
      issuer: guardia.emitido_por || 'OS-10 Carabineros de Chile',
      expiresAt: guardia.fecha_vencimiento ? String(guardia.fecha_vencimiento).slice(0, 10) : '',
    });
  }
  return {
    name: guardia.nombre_completo,
    rut: guardia.rut,
    role: guardia.cargo || '',
    weeklyContractHours: Number(guardia.horas_semanales_max) || Number(weeklyHours) || 42,
    startDate: guardia.fecha_contrato ? String(guardia.fecha_contrato).slice(0, 10) : startDate,
    phone: guardia.telefono || '',
    preferredShiftIds: [],
    unavailableWeekdays: [],
    certifications,
    active: true,
  };
}

export function plantillaToShift(plantilla, { color = DEFAULT_COLOR, coverage = DEFAULT_COVERAGE } = {}) {
  return {
    name: plantilla.nombre,
    code: plantilla.codigo || String(plantilla.nombre || 'T').slice(0, 3).toUpperCase(),
    start: String(plantilla.hora_inicio || '09:00').slice(0, 5),
    end: String(plantilla.hora_fin || '18:00').slice(0, 5),
    breakMinutes: Number(plantilla.minutos_colacion) || 0,
    night: Boolean(plantilla.es_nocturno),
    color: plantilla.color || color,
    coverage: Array.isArray(plantilla.cobertura_semanal)
      ? plantilla.cobertura_semanal.slice(0, 7).map((value) => Number(value) || 0)
      : [...coverage],
    requiredCertifications: Array.isArray(plantilla.certificaciones_requeridas)
      ? plantilla.certificaciones_requeridas
      : [],
  };
}

/** Solo los trabajadores activos pasan a una planificación. */
export function activeGuardias(base) {
  return (Array.isArray(base) ? base : []).filter((guardia) => guardia.activo !== false);
}
