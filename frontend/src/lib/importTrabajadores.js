/**
 * Lectura y revisión previa de planillas de trabajadores (Excel .xlsx o CSV).
 *
 * Todo lo que está aquí es puro (no usa React ni el DOM) salvo `leerPlanilla`, que lee el archivo.
 * La revisión de cada fila replica la del servidor (`backend/src/utils/trabajadores.js`): el
 * servidor vuelve a validar al guardar, esta copia solo sirve para mostrar la vista previa. Un
 * test compara ambas con los mismos casos para que no se separen.
 */

export const MAX_FILAS = 1000;
export const MAX_BYTES = 5 * 1024 * 1024;
export const HORAS_POR_DEFECTO = 42;

/** Columnas que entiende la carga. `alias` son los nombres de encabezado aceptados (sin tildes). */
export const COLUMNAS = [
  {
    campo: 'nombre_completo',
    titulo: 'Nombre completo',
    obligatoria: true,
    alias: ['nombrecompleto', 'nombre', 'nombres', 'nombreyapellido', 'nombreapellido', 'apellidosynombres', 'trabajador', 'nombredeltrabajador'],
  },
  { campo: 'rut', titulo: 'RUT', obligatoria: true, alias: ['rut', 'run', 'rutdeltrabajador', 'identificacion'] },
  { campo: 'cargo', titulo: 'Cargo', alias: ['cargo', 'puesto', 'funcion', 'ocupacion'] },
  { campo: 'email', titulo: 'Correo', alias: ['correo', 'email', 'correoelectronico', 'mail', 'emailcorreo'] },
  { campo: 'telefono', titulo: 'Teléfono', alias: ['telefono', 'celular', 'fono', 'movil', 'telefonomovil', 'telefonocelular'] },
  {
    campo: 'fecha_contrato',
    titulo: 'Fecha de contrato',
    alias: ['fechadecontrato', 'fechacontrato', 'fechadeingreso', 'fechaingreso', 'ingreso', 'fechadeinicio', 'fechacontratacion'],
  },
  {
    campo: 'horas_semanales_max',
    titulo: 'Horas semanales',
    alias: ['horassemanales', 'horassemanalesmax', 'horassemanalesmaximas', 'jornada', 'jornadasemanal', 'horas', 'horassemana'],
  },
  { campo: 'activo', titulo: 'Activo', alias: ['activo', 'estado', 'vigente'] },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RUT_FORMATO = /^\d{6,8}-[0-9K]$/;
const VERDADEROS = new Set(['true', '1', 'si', 'sí', 's', 'activo', 'activa', 'vigente', 'yes', 'y']);
const FALSOS = new Set(['false', '0', 'no', 'n', 'inactivo', 'inactiva', 'baja', 'desvinculado']);

export function normalizarRut(valor) {
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

export function rutValido(valor) {
  const rut = normalizarRut(valor);
  if (!RUT_FORMATO.test(rut)) return false;
  const [cuerpo, dv] = rut.split('-');
  return digitoVerificador(cuerpo) === dv;
}

function texto(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).replace(/\s+/g, ' ').trim();
}

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

/** Misma revisión que hace el servidor. */
export function validarFila(entrada, { hoy = new Date() } = {}) {
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
    const limiteSuperior = new Date(Date.UTC(hoy.getUTCFullYear() + 1, hoy.getUTCMonth(), hoy.getUTCDate()))
      .toISOString()
      .slice(0, 10);
    if (!fechaValida(fechaTexto) || fechaTexto < '1950-01-01' || fechaTexto > limiteSuperior) {
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

/* ----------------------------- Lectura del archivo ----------------------------- */

function sinTildes(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** "Fecha de Contrato" → "fechadecontrato" */
function claveEncabezado(valor) {
  return sinTildes(valor)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function pad(n) {
  return String(n).padStart(2, '0');
}

/** Convierte lo que venga en la celda de fecha a AAAA-MM-DD, o lo deja tal cual si no lo entiende. */
function fechaDesdeCelda(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return String(valor);
    // Excel entrega las fechas a medianoche UTC: se leen con los componentes UTC para no correrlas un día.
    return `${valor.getUTCFullYear()}-${pad(valor.getUTCMonth() + 1)}-${pad(valor.getUTCDate())}`;
  }
  if (typeof valor === 'number') {
    // Número de serie de Excel (días desde 1899-12-30).
    if (valor > 20000 && valor < 80000) {
      const fecha = new Date(Date.UTC(1899, 11, 30) + Math.round(valor) * 86400000);
      return `${fecha.getUTCFullYear()}-${pad(fecha.getUTCMonth() + 1)}-${pad(fecha.getUTCDate())}`;
    }
    return String(valor);
  }
  const t = String(valor).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t); // formato chileno: día-mes-año
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  return t;
}

function celdaATexto(valor) {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return fechaDesdeCelda(valor);
  return valor;
}

/** Interpreta el texto de un CSV (separador coma, punto y coma o tabulación; comillas dobles). */
export function parsearCSV(contenido) {
  const t = String(contenido ?? '').replace(/^﻿/, '');
  const primeraLinea = t.split(/\r?\n/, 1)[0] || '';
  const cuentas = { ';': 0, ',': 0, '\t': 0 };
  let enComillas = false;
  for (const c of primeraLinea) {
    if (c === '"') enComillas = !enComillas;
    else if (!enComillas && c in cuentas) cuentas[c] += 1;
  }
  const delimitador = Object.entries(cuentas).sort((a, b) => b[1] - a[1])[0][0];

  const filas = [];
  let fila = [];
  let celda = '';
  enComillas = false;
  for (let i = 0; i < t.length; i += 1) {
    const c = t[i];
    if (enComillas) {
      if (c === '"' && t[i + 1] === '"') {
        celda += '"';
        i += 1;
      } else if (c === '"') {
        enComillas = false;
      } else {
        celda += c;
      }
    } else if (c === '"') {
      enComillas = true;
    } else if (c === delimitador) {
      fila.push(celda);
      celda = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i += 1;
      fila.push(celda);
      celda = '';
      filas.push(fila);
      fila = [];
    } else {
      celda += c;
    }
  }
  if (celda !== '' || fila.length > 0) {
    fila.push(celda);
    filas.push(fila);
  }
  return filas;
}

function decodificarTexto(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    // Excel en español guarda el CSV en Windows-1252 si no se elige UTF-8.
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

/** Lee un archivo .xlsx o .csv y devuelve las filas (arreglos de celdas). */
export async function leerPlanilla(archivo) {
  if (!archivo) throw new Error('Elige un archivo.');
  if (archivo.size > MAX_BYTES) throw new Error('El archivo pesa más de 5 MB. Divídelo en partes.');
  const nombre = String(archivo.name || '').toLowerCase();

  if (nombre.endsWith('.csv') || nombre.endsWith('.txt') || archivo.type === 'text/csv') {
    return parsearCSV(decodificarTexto(await archivo.arrayBuffer()));
  }
  if (nombre.endsWith('.xlsx')) {
    // Se carga solo cuando se usa: no pesa en el resto de la aplicación.
    const { readSheet } = await import('read-excel-file/web-worker');
    try {
      return await readSheet(await archivo.arrayBuffer());
    } catch {
      throw new Error('No pude leer el archivo. Revisa que sea un Excel (.xlsx) sin contraseña.');
    }
  }
  if (nombre.endsWith('.xls')) {
    throw new Error('Los archivos .xls antiguos no se pueden leer. Guárdalo como .xlsx o como CSV desde Excel.');
  }
  throw new Error('Usa un archivo Excel (.xlsx) o CSV.');
}

/* ------------------------------ Revisión previa ------------------------------ */

function filaVacia(celdas) {
  return celdas.every((c) => c === null || c === undefined || String(c).trim() === '');
}

/**
 * Revisa todas las filas de la planilla.
 * @param {Array<Array>} filas  Primera fila = encabezados.
 * @param {{ existentes?: Set<string> }} opciones  RUT (normalizados) que ya están en la base de la empresa.
 */
export function analizarPlanilla(filas, { existentes = new Set(), hoy = new Date() } = {}) {
  const salida = {
    filas: [],
    ignoradas: [],
    faltantes: [],
    resumen: { total: 0, listos: 0, errores: 0, existentes: 0, repetidos: 0 },
    demasiadas: false,
  };

  const indiceEncabezado = filas.findIndex((f) => !filaVacia(f));
  if (indiceEncabezado === -1) {
    salida.faltantes = COLUMNAS.filter((c) => c.obligatoria).map((c) => c.titulo);
    return salida;
  }

  // Qué columna del archivo corresponde a cada campo.
  const encabezados = filas[indiceEncabezado];
  const columnaDe = {};
  encabezados.forEach((encabezado, indice) => {
    const clave = claveEncabezado(encabezado);
    if (!clave) return;
    const definicion = COLUMNAS.find((c) => c.alias.includes(clave));
    if (definicion && columnaDe[definicion.campo] === undefined) columnaDe[definicion.campo] = indice;
    else salida.ignoradas.push(texto(encabezado));
  });
  salida.faltantes = COLUMNAS.filter((c) => c.obligatoria && columnaDe[c.campo] === undefined).map((c) => c.titulo);
  if (salida.faltantes.length) return salida;

  const vistos = new Map();
  for (let i = indiceEncabezado + 1; i < filas.length; i += 1) {
    const celdas = filas[i];
    if (filaVacia(celdas)) continue;
    if (salida.filas.length >= MAX_FILAS) {
      salida.demasiadas = true;
      break;
    }

    const crudo = {};
    for (const { campo } of COLUMNAS) {
      const indice = columnaDe[campo];
      const valor = indice === undefined ? '' : celdas[indice];
      crudo[campo] = campo === 'fecha_contrato' ? fechaDesdeCelda(valor) : celdaATexto(valor);
    }

    const numero = i + 1; // número de fila tal como se ve en Excel
    const revision = validarFila(crudo, { hoy });
    const item = {
      fila: numero,
      nombre: texto(crudo.nombre_completo),
      rut: texto(crudo.rut),
      datos: revision.datos,
      errores: revision.errores,
      estado: 'ok',
      motivo: '',
    };

    if (revision.errores.length) {
      item.estado = 'error';
      item.motivo = revision.errores.join(' ');
      salida.resumen.errores += 1;
    } else if (vistos.has(revision.datos.rut)) {
      item.estado = 'repetido';
      item.motivo = `RUT repetido en el archivo (ya aparece en la fila ${vistos.get(revision.datos.rut)}).`;
      salida.resumen.repetidos += 1;
    } else {
      vistos.set(revision.datos.rut, numero);
      if (existentes.has(revision.datos.rut)) {
        item.estado = 'existe';
        item.motivo = 'Ya existe un trabajador con ese RUT.';
        salida.resumen.existentes += 1;
      } else {
        salida.resumen.listos += 1;
      }
    }
    salida.filas.push(item);
  }
  salida.resumen.total = salida.filas.length;
  return salida;
}

/** Filas listas para enviar al servidor. */
export function filasParaImportar(analisis) {
  return analisis.filas
    .filter((f) => f.estado === 'ok')
    .map((f) => ({ fila: f.fila, ...f.datos }));
}
