import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getJwtSecret } = require('../src/config/jwt.js');
const { checkSetupToken } = require('../src/utils/setupToken.js');

const STRONG = 'a'.repeat(48);

test('JWT: producción exige JWT_SECRET', () => {
  assert.throws(() => getJwtSecret({ NODE_ENV: 'production' }), /JWT_SECRET no está definido/);
  assert.throws(() => getJwtSecret({}), /JWT_SECRET no está definido/);
});

test('JWT: rechaza valores de ejemplo y secretos cortos fuera de desarrollo', () => {
  for (const value of [
    'secret_dev',
    'cambia_este_valor_en_produccion',
    'cambiar_por_un_secreto_seguro_en_produccion',
  ]) {
    assert.throws(
      () => getJwtSecret({ NODE_ENV: 'production', JWT_SECRET: value }),
      /valor de ejemplo/
    );
  }
  assert.throws(
    () => getJwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'corto' }),
    /al menos 32 caracteres/
  );
});

test('JWT: acepta un secreto fuerte', () => {
  assert.equal(getJwtSecret({ NODE_ENV: 'production', JWT_SECRET: STRONG }), STRONG);
});

test('JWT: desarrollo y pruebas usan un secreto local sin romper', () => {
  assert.ok(getJwtSecret({ NODE_ENV: 'development' }).length >= 32);
  assert.ok(getJwtSecret({ NODE_ENV: 'test' }).length >= 32);
  assert.equal(getJwtSecret({ NODE_ENV: 'development', JWT_SECRET: 'x' }), 'x');
});

test('setup: con SETUP_TOKEN exige un código idéntico', () => {
  const env = { NODE_ENV: 'production', SETUP_TOKEN: 'codigo-largo-123' };
  assert.deepEqual(checkSetupToken('codigo-largo-123', env), { ok: true });

  const wrong = checkSetupToken('otro', env);
  assert.equal(wrong.ok, false);
  assert.equal(wrong.status, 403);

  const missing = checkSetupToken(undefined, env);
  assert.equal(missing.ok, false);
  assert.equal(missing.status, 403);
});

test('setup: sin SETUP_TOKEN queda deshabilitado en producción', () => {
  const result = checkSetupToken('lo-que-sea', { NODE_ENV: 'production' });
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);

  // También cuando NODE_ENV no está definido (se trata como producción).
  assert.equal(checkSetupToken('x', {}).ok, false);
});

test('setup: en desarrollo sin SETUP_TOKEN se permite', () => {
  assert.deepEqual(checkSetupToken('', { NODE_ENV: 'development' }), { ok: true });
});
