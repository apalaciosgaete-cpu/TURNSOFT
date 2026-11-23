import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { validarLogo, MAX_CHARS } = require('../src/utils/logo.js');

// 1x1 PNG real
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const JPEG = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]).toString('base64');
const WEBP =
  'data:image/webp;base64,' +
  Buffer.concat([Buffer.from('RIFF'), Buffer.from([4, 0, 0, 0]), Buffer.from('WEBP')]).toString('base64');

test('acepta PNG, JPEG y WebP reales', () => {
  for (const imagen of [PNG, JPEG, WEBP]) {
    assert.equal(validarLogo(imagen).value, imagen);
  }
});

test('rechaza SVG, otros tipos y texto que no es una imagen', () => {
  const svg = 'data:image/svg+xml;base64,' + Buffer.from('<svg onload="alert(1)"/>').toString('base64');
  assert.ok(validarLogo(svg).error);
  assert.ok(validarLogo('data:text/html;base64,PGgxPg==').error);
  assert.ok(validarLogo('https://sitio.cl/logo.png').error);
  assert.ok(validarLogo('').error);
  assert.ok(validarLogo(null).error);
  assert.ok(validarLogo({ imagen: PNG }).error);
});

test('rechaza una imagen declarada PNG cuyo contenido no lo es', () => {
  const falso = 'data:image/png;base64,' + Buffer.from('esto no es un png de verdad').toString('base64');
  assert.match(validarLogo(falso).error, /no es una imagen válida/);
});

test('rechaza imágenes demasiado pesadas', () => {
  const pesado = 'data:image/png;base64,' + 'A'.repeat(MAX_CHARS);
  assert.match(validarLogo(pesado).error, /pesada/);
});
