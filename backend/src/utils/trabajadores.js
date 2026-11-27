/**
 * Validación de trabajadores para la carga masiva (Excel, CSV o conexiones con otras aplicaciones).
 *
 * Es la validación que manda: el navegador hace la misma revisión para mostrar la vista previa,
 * pero el servidor vuelve a validar cada fila antes de guardar. Cualquier conexión futura con otro
 * sistema debe pasar por aquí.
 */

const MAX_FILAS_IMPORTACION = 1000;
const HORAS_POR_DEFECTO = 42;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RUT_FORMATO = /^\d{6,8}-[0-9K]$/;

const VERDADEROS = new Set(['true', '1', 'si', 'sí', 's', 'activo', 'activa', 'vigente', 'yes', 'y']);
const FALSOS = new Set(['false', '0', 'no', 'n', 'inactivo', 'inactiva', 'baja', 'desvinculado']);

/** "18.123.456-k" → "18123456-K" */
function normalizarRut(valor) {
  return String(valor ?? '')
    .replace(/[.\s]/g, '')
    .toUpperCase();
}

function digitoVerificador(cuerpo) {
  let suma = 0;
  let multiplicador = 2;
  for (let i = cuerpo.length - 1; i >= 0; i -= 1) {
    suma += Number(cuerpo[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return '0';
  if (resto === 10) return 'K';
  return String(resto);
}

function rutValido(valor) {
  const rut = normalizarRut(valor);
  if (!RUT_FORMATO.test(rut)) return false;
  const [cuerpo, dv] = rut.split('-');
  return digitoVerificador(cuerpo) === dv;
}

function texto(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).replace(/\s+/g, ' ').trim();
}

/** Acepta solo AAAA-MM-DD y verifica que sea una fecha real del calendario. */
function fechaValida(valor) {
  const coincide = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valor));
  if (!coincide) return false;
  const [, y, m, d] = coincide.map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d));
  return fecha.getUTCFullYear() === y && fecha.getUTCMonth() === m - 1 && fecha.getUTCDate() === d;
}

function normalizarActivo(valor) {
  if (valor === null || valor === undefined || valor === '') return { valor: true };
  if (typeof valor === 'boolean') return { valor };
  const clave = String(valor).trim().toLowerCase();
  if (clave === '') return { valor: true };
  if (VERDADEROS.has(clave)) return { valor: true };
  if (FALSOS.has(clave)) return { valor: false };
  return { error: 'En "Activo" escribe Sí o No.' };
}

/**
 * Valida y normaliza una fila.
 * @returns {{ errores: string[], datos: object|null }}
 */
function validarTrabajador(entrada, { hoy = new Date() } = {}) {
  const fila = entrada && typeof entrada === 'object' ? entrada : {};
  const errores = [];

  const nombre = texto(fila.nombre_completo);
  if (nombre.length < 2) errores.push('Falta el nombre completo.');
  else if (nombre.length > 200) errores.push('El nombre es demasiado largo (máximo 200 caracteres).');

  const rutTexto = texto(fila.rut);
  const rut = normalizarRut(rutTexto);
  if (!rutTexto) errores.push('Falta el RUT.');
  else if (!rutValido(rut)) errores.push('El RUT no es válido (revisa el dígito verificador).');

  const cargo = texto(fila.cargo);
  if (cargo.length > 100) errores.push('El cargo es demasiado largo (máximo 100 caracteres).');

  const email = texto(fila.email).toLowerCase();
  if (email && (email.length > 200 || !EMAIL_RE.test(email))) errores.push('El correo no es válido.');

  const telefono = texto(fila.telefono);
  if (telefono.length > 20) errores.push('El teléfono es demasiado largo (máximo 20 caracteres).');

  let fecha = null;
  const fechaTexto = texto(fila.fecha_contrato);
  if (fechaTexto) {
    const limiteInferior = '1950-01-01';
    const limiteSuperior = new Date(Date.UTC(hoy.getUTCFullYear() + 1, hoy.getUTCMonth(), hoy.getUTCDate()))
      .toISOString()
      .slice(0, 10);
    if (!fechaValida(fechaTexto) || fechaTexto < limiteInferior || fechaTexto > limiteSuperior) {
      errores.push('La fecha de contrato no es válida.');
    } else {
      fecha = fechaTexto;
    }
  }

  let horas = HORAS_POR_DEFECTO;
  const horasTexto = texto(fila.horas_semanales_max);
  if (horasTexto) {
    const numero = Number(horasTexto.replace(',', '.'));
    if (!Number.isFinite(numero) || numero < 1 || numero > 60) {
      errores.push('Las horas semanales deben estar entre 1 y 60.');
    } else {
      horas = Math.round(numero);
    }
  }

  const activo = normalizarActivo(fila.activo);
  if (activo.error) errores.push(activo.error);

  if (errores.length) return { errores, datos: null };

  return {
    errores,
    datos: {
      nombre_completo: nombre,
      rut,
      cargo: cargo || null,
      email: email || null,
      telefono: telefono || null,
      fecha_contrato: fecha,
      horas_semanales_max: horas,
      activo: activo.valor,
    },
  };
}

module.exports = {
  MAX_FILAS_IMPORTACION,
  HORAS_POR_DEFECTO,
  normalizarRut,
  rutValido,
  validarTrabajador,
};
