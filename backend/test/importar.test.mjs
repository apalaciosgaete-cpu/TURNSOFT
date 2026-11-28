import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const servidor = require('../src/utils/trabajadores.js');
const cliente = await import('../../frontend/src/lib/importTrabajadores.js');

const HOY = new Date(Date.UTC(2026, 10, 26));

// RUT con dígito verificador correcto (calculado con el algoritmo módulo 11).
const RUT_OK = '12.345.678-5';
const RUT_OK_2 = '9.758.872-4';

const base = {
  nombre_completo: 'Camila Rojas Soto',
  rut: RUT_OK,
  cargo: 'Enfermera universitaria',
  email: 'Camila.Rojas@Clinica.cl',
  telefono: '+56 9 1234 5678',
  fecha_contrato: '2024-03-15',
  horas_semanales_max: 42,
  activo: true,
};

test('el RUT de prueba es válido y uno con el dígito cambiado no', () => {
  assert.equal(servidor.rutValido(RUT_OK), true);
  assert.equal(servidor.rutValido(RUT_OK_2), true);
  assert.equal(servidor.rutValido('12.345.678-9'), false);
  assert.equal(servidor.rutValido('abc'), false);
  assert.equal(servidor.rutValido(''), false);
  assert.equal(servidor.normalizarRut(' 9.758.872-k '), '9758872-K');
});

test('una fila correcta se normaliza', () => {
  const r = servidor.validarTrabajador(base, { hoy: HOY });
  assert.deepEqual(r.errores, []);
  assert.deepEqual(r.datos, {
    nombre_completo: 'Camila Rojas Soto',
    rut: '12345678-5',
    cargo: 'Enfermera universitaria',
    email: 'camila.rojas@clinica.cl',
    telefono: '+56 9 1234 5678',
    fecha_contrato: '2024-03-15',
    horas_semanales_max: 42,
    activo: true,
  });
});

test('solo el nombre y el RUT son obligatorios; el resto toma valores por defecto', () => {
  const r = servidor.validarTrabajador({ nombre_completo: 'Pedro Vera', rut: RUT_OK }, { hoy: HOY });
  assert.deepEqual(r.errores, []);
  assert.equal(r.datos.horas_semanales_max, 42);
  assert.equal(r.datos.activo, true);
  assert.equal(r.datos.cargo, null);
  assert.equal(r.datos.email, null);
  assert.equal(r.datos.fecha_contrato, null);
});

test('cada problema se informa con un mensaje claro', () => {
  const casos = [
    [{ ...base, nombre_completo: ' ' }, 'nombre'],
    [{ ...base, rut: '' }, 'Falta el RUT'],
    [{ ...base, rut: '12.345.678-9' }, 'dígito verificador'],
    [{ ...base, email: 'sin-arroba' }, 'correo'],
    [{ ...base, telefono: '1'.repeat(21) }, 'teléfono'],
    [{ ...base, fecha_contrato: '2024-02-31' }, 'fecha'],
    [{ ...base, fecha_contrato: '1900-01-01' }, 'fecha'],
    [{ ...base, fecha_contrato: '2031-01-01' }, 'fecha'],
    [{ ...base, horas_semanales_max: 0 }, 'horas'],
    [{ ...base, horas_semanales_max: 61 }, 'horas'],
    [{ ...base, horas_semanales_max: 'mucho' }, 'horas'],
    [{ ...base, activo: 'tal vez' }, 'Activo'],
  ];
  for (const [fila, pista] of casos) {
    const r = servidor.validarTrabajador(fila, { hoy: HOY });
    assert.equal(r.datos, null, JSON.stringify(fila));
    assert.ok(
      r.errores.some((e) => e.toLowerCase().includes(pista.toLowerCase())),
      `${pista}: ${r.errores.join(' | ')}`
    );
  }
});

test('"Activo" entiende Sí, No y variantes', () => {
  const activo = (valor) => servidor.validarTrabajador({ ...base, activo: valor }, { hoy: HOY }).datos.activo;
  for (const v of ['Sí', 'si', 'SI', 'activo', true, '1', '', undefined]) assert.equal(activo(v), true, String(v));
  for (const v of ['No', 'no', 'Inactivo', false, '0']) assert.equal(activo(v), false, String(v));
});

test('el navegador y el servidor llegan al mismo resultado con los mismos casos', () => {
  const casos = [
    base,
    { nombre_completo: 'Pedro Vera', rut: RUT_OK },
    { ...base, rut: '12.345.678-9' },
    { ...base, email: 'x' },
    { ...base, fecha_contrato: '2024-13-01' },
    { ...base, horas_semanales_max: '37,5' },
    { ...base, activo: 'No' },
    { ...base, nombre_completo: '   Ana   María  Pérez ', cargo: '  TENS ' },
    {},
  ];
  for (const caso of casos) {
    assert.deepEqual(cliente.validarFila(caso, { hoy: HOY }), servidor.validarTrabajador(caso, { hoy: HOY }), JSON.stringify(caso));
  }
});

test('CSV: detecta el separador, las comillas y el formato de Windows', () => {
  const punto = cliente.parsearCSV('﻿RUT;Nombre\r\n12.345.678-5;"Rojas, Camila"\r\n9.758.872-4;"Dice ""hola"""');
  assert.deepEqual(punto, [
    ['RUT', 'Nombre'],
    ['12.345.678-5', 'Rojas, Camila'],
    ['9.758.872-4', 'Dice "hola"'],
  ]);
  const coma = cliente.parsearCSV('a,b,c\n1,2,3\n');
  assert.deepEqual(coma, [['a', 'b', 'c'], ['1', '2', '3']]);
  const tab = cliente.parsearCSV('a\tb\n1\t2');
  assert.deepEqual(tab, [['a', 'b'], ['1', '2']]);
});

test('planilla: reconoce encabezados distintos, ignora columnas extra y revisa cada fila', () => {
  const filas = [
    ['Nombre', 'RUN', 'Puesto', 'E-mail', 'Celular', 'Fecha ingreso', 'Jornada', 'Estado', 'Unidad'],
    ['Camila Rojas', '12.345.678-5', 'Enfermera', 'c@x.cl', '+56 9 1111 2222', '15-03-2024', 42, 'Sí', 'UCI'],
    ['Pedro Vera', '9.758.872-4', 'TENS', '', '', '', '', 'No', 'Urgencia'],
    ['', '', '', '', '', '', '', '', ''],
    ['Rut malo', '12.345.678-9', '', '', '', '', '', '', ''],
    ['Camila repetida', '12345678-5', '', '', '', '', '', '', ''],
  ];
  const a = cliente.analizarPlanilla(filas, { hoy: HOY });
  assert.deepEqual(a.faltantes, []);
  assert.deepEqual(a.ignoradas, ['Unidad']);
  assert.deepEqual(a.resumen, { total: 4, listos: 2, errores: 1, existentes: 0, repetidos: 1 });
  assert.equal(a.filas[0].datos.fecha_contrato, '2024-03-15');
  assert.equal(a.filas[1].datos.activo, false);
  assert.equal(a.filas[2].estado, 'error');
  assert.equal(a.filas[2].fila, 5, 'la fila se numera como en Excel');
  assert.equal(a.filas[3].estado, 'repetido');
  assert.match(a.filas[3].motivo, /fila 2/);
  assert.deepEqual(
    cliente.filasParaImportar(a).map((f) => f.fila),
    [2, 3]
  );
});

test('planilla: marca los RUT que ya están en la base de la empresa', () => {
  const filas = [
    ['Nombre completo', 'RUT'],
    ['Camila Rojas', '12.345.678-5'],
    ['Pedro Vera', '9.758.872-4'],
  ];
  const a = cliente.analizarPlanilla(filas, { existentes: new Set(['12345678-5']), hoy: HOY });
  assert.deepEqual(a.resumen, { total: 2, listos: 1, errores: 0, existentes: 1, repetidos: 0 });
  assert.equal(a.filas[0].estado, 'existe');
});

test('planilla: sin columnas de nombre o RUT no se importa nada', () => {
  const a = cliente.analizarPlanilla([['Cargo', 'Correo'], ['TENS', 'a@b.cl']], { hoy: HOY });
  assert.deepEqual(a.faltantes, ['Nombre completo', 'RUT']);
  assert.equal(a.filas.length, 0);
  assert.deepEqual(cliente.analizarPlanilla([], { hoy: HOY }).faltantes, ['Nombre completo', 'RUT']);
});

test('fechas de Excel: se leen en UTC y no se corren un día en la hora de Chile', () => {
  // Excel entrega las fechas a medianoche UTC. Con la hora local de Santiago (UTC-3 o UTC-4)
  // los componentes locales darían el día anterior.
  const filas = [
    ['Nombre', 'RUT', 'Fecha de contrato'],
    ['Camila Rojas', RUT_OK, new Date(Date.UTC(2019, 5, 9))],
    ['Pedro Vera', RUT_OK_2, 43625], // número de serie de Excel = 2019-06-09
  ];
  const a = cliente.analizarPlanilla(filas, { hoy: HOY });
  assert.equal(a.filas[0].datos.fecha_contrato, '2019-06-09');
  assert.equal(a.filas[1].datos.fecha_contrato, '2019-06-09');
});

test('planilla: se detiene en el máximo de filas por carga', () => {
  const filas = [['Nombre', 'RUT']];
  for (let i = 0; i < cliente.MAX_FILAS + 5; i += 1) filas.push([`Trabajador ${i}`, '']);
  const a = cliente.analizarPlanilla(filas, { hoy: HOY });
  assert.equal(a.demasiadas, true);
  assert.equal(a.filas.length, cliente.MAX_FILAS);
  assert.equal(cliente.MAX_FILAS, servidor.MAX_FILAS_IMPORTACION);
});
