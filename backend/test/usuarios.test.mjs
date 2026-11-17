import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const tenant = require('../src/middleware/tenant.js');
const { generateTempPassword, hashPassword, verifyPassword } = require('../src/utils/password.js');

const titular = { rol: 'operador', empresa_id: 'e1', cliente_id: null };
const admin = { rol: 'admin', empresa_id: 'e1', cliente_id: null };
const validador = { rol: 'validador', empresa_id: 'e1', cliente_id: null };
const cliente = { rol: 'cliente', empresa_id: 'e1', cliente_id: 'c1' };
const maestro = { rol: 'superadmin', empresa_id: null, cliente_id: null };

function run(middleware, user) {
  let status = null;
  let nextCalled = false;
  const res = {
    status(code) { status = code; return this; },
    json() { return this; },
  };
  middleware({ user }, res, () => { nextCalled = true; });
  return { status, nextCalled };
}

test('matriz de permisos: quién modifica, quién aprueba, quién gestiona usuarios', () => {
  const casos = [
    // [usuario, isOperator, canApprove, canManageUsers]
    [titular, true, true, true],
    [admin, true, true, true],
    [validador, false, true, false],
    [cliente, false, false, false],
    [maestro, false, false, false],
  ];
  for (const [user, modifica, aprueba, gestiona] of casos) {
    assert.equal(tenant.isOperator(user), modifica, `isOperator ${user.rol}`);
    assert.equal(tenant.canApprove(user), aprueba, `canApprove ${user.rol}`);
    assert.equal(tenant.canManageUsers(user), gestiona, `canManageUsers ${user.rol}`);
  }
});

test('el validador ve a todos los clientes pero no puede modificar', () => {
  assert.equal(tenant.scopedClienteId(validador, null), null);
  assert.equal(tenant.scopedClienteId(validador, 'c9'), 'c9');
  assert.equal(run(tenant.denyValidador, validador).status, 403);
  assert.equal(run(tenant.denyValidador, admin).nextCalled, true);
  assert.equal(run(tenant.denyValidador, cliente).nextCalled, true);
});

test('aprobar exige titular, administrador o validador', () => {
  assert.equal(run(tenant.requireApprover, validador).nextCalled, true);
  assert.equal(run(tenant.requireApprover, admin).nextCalled, true);
  assert.equal(run(tenant.requireApprover, titular).nextCalled, true);
  assert.equal(run(tenant.requireApprover, cliente).status, 403);
  assert.equal(run(tenant.requireApprover, undefined).status, 403);
});

test('gestionar usuarios exige titular o administrador', () => {
  assert.equal(run(tenant.requireUserManager, titular).nextCalled, true);
  assert.equal(run(tenant.requireUserManager, admin).nextCalled, true);
  assert.equal(run(tenant.requireUserManager, validador).status, 403);
  assert.equal(run(tenant.requireUserManager, cliente).status, 403);
});

test('requireOperator excluye al validador', () => {
  assert.equal(run(tenant.requireOperator, validador).status, 403);
  assert.equal(run(tenant.requireOperator, admin).nextCalled, true);
});

test('la clave temporal es legible, única y verificable', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i += 1) {
    const clave = generateTempPassword();
    assert.equal(clave.length, 12);
    assert.match(clave, /^[A-HJ-NP-Za-km-z2-9]+$/, 'sin caracteres ambiguos');
    seen.add(clave);
  }
  assert.equal(seen.size, 200);
  const clave = generateTempPassword(16);
  assert.equal(clave.length, 16);
  assert.equal(verifyPassword(clave, hashPassword(clave)), true);
  assert.equal(verifyPassword(`${clave}x`, hashPassword(clave)), false);
});

test('el tratamiento de datos se exige a las cuentas internas de una empresa', () => {
  const { requiereTratamientoDatos } = require('../src/middleware/auth.js');
  assert.equal(requiereTratamientoDatos(titular), true);
  assert.equal(requiereTratamientoDatos(admin), true);
  assert.equal(requiereTratamientoDatos(validador), true);
  assert.equal(requiereTratamientoDatos(cliente), false);
  assert.equal(requiereTratamientoDatos(maestro), false);
  assert.equal(requiereTratamientoDatos({ rol: 'admin', empresa_id: null }), false);
});
