import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const tenant = require('../src/middleware/tenant.js');
const scheduler = require('../src/services/scheduler.js');

const {
  OPERATOR,
  CLIENTS,
  DEMO_PASSWORD,
  createClientScenarios,
  getDemoAccounts,
  getClientById,
} = await import('../../shared/tenants.js');

test('Vigo Seguridad tiene ocho clientes con identidad única', () => {
  assert.equal(OPERATOR.name, 'Vigo Seguridad');
  assert.equal(CLIENTS.length, 8);
  assert.equal(new Set(CLIENTS.map((client) => client.id)).size, 8);
  assert.equal(new Set(CLIENTS.map((client) => client.name)).size, 8);
  assert.equal(new Set(CLIENTS.map((client) => client.sector)).size, 5);
});

test('cada cuenta demo apunta a un único cliente y comparte la clave demo', () => {
  const accounts = getDemoAccounts();
  assert.equal(accounts.length, 9);
  assert.equal(accounts.filter((account) => account.role === 'operador').length, 1);
  assert.equal(accounts.filter((account) => account.role === 'cliente').length, 8);
  assert.equal(new Set(accounts.map((account) => account.email)).size, 9);
  assert.ok(accounts.every((account) => account.password === DEMO_PASSWORD));

  for (const account of accounts.filter((item) => item.role === 'cliente')) {
    const client = getClientById(account.clientId);
    assert.ok(client, `Cuenta ${account.email} sin cliente válido`);
    assert.equal(account.clientName, client.name);
  }
});

test('los escenarios demo están namespaced por cliente', () => {
  const scenarios = createClientScenarios();
  assert.equal(scenarios.length, 8);
  assert.equal(new Set(scenarios.map((scenario) => scenario.id)).size, 8);

  const employeeIds = scenarios.flatMap((scenario) =>
    scenario.employees.map((employee) => employee.id)
  );
  const shiftIds = scenarios.flatMap((scenario) => scenario.shifts.map((shift) => shift.id));

  assert.equal(new Set(employeeIds).size, employeeIds.length);
  assert.equal(new Set(shiftIds).size, shiftIds.length);

  for (const scenario of scenarios) {
    assert.ok(getClientById(scenario.clientId));
    assert.equal(scenario.operatorName, OPERATOR.name);
    assert.ok(scenario.employees.length > 0);
    assert.ok(scenario.shifts.length > 0);
    for (const employee of scenario.employees) {
      assert.ok(employee.id.startsWith(`${scenario.clientId}-`));
    }
    for (const shift of scenario.shifts) {
      assert.ok(shift.id.startsWith(`${scenario.clientId}-`));
    }
  }
});

test('un usuario cliente queda forzado a su propio cliente', () => {
  const user = { id: 'u1', rol: 'cliente', empresa_id: 'emp-1', cliente_id: 'cli-001' };
  assert.equal(tenant.scopedClienteId(user, 'cli-001'), 'cli-001');
  assert.equal(tenant.scopedClienteId(user), 'cli-001');
  assert.throws(
    () => tenant.scopedClienteId(user, 'cli-002'),
    (error) => error.status === 403 && /otro cliente/i.test(error.message)
  );
  assert.throws(
    () => tenant.assertClienteAccess(user, 'cli-002'),
    (error) => error.status === 403
  );
  assert.doesNotThrow(() => tenant.assertClienteAccess(user, 'cli-001'));
});

test('un operador puede filtrar por cliente, pero no salir de su empresa', () => {
  const user = { id: 'u0', rol: 'operador', empresa_id: 'emp-1', cliente_id: null };
  assert.equal(tenant.isOperator(user), true);
  assert.equal(tenant.scopedClienteId(user, 'cli-004'), 'cli-004');
  assert.equal(tenant.scopedClienteId(user), null);
  assert.equal(tenant.scopedEmpresaId(user), 'emp-1');
  assert.equal(tenant.scopedEmpresaId(user, 'emp-1'), 'emp-1');
  assert.throws(
    () => tenant.scopedEmpresaId(user, 'emp-2'),
    (error) => error.status === 403 && /otra empresa/i.test(error.message)
  );
  assert.throws(() => tenant.assertEmpresaAccess(user, 'emp-2'), (error) => error.status === 403);
});

test('solo el operador administra cuentas y catálogos globales', () => {
  assert.equal(tenant.isOperator({ rol: 'cliente', cliente_id: 'cli-001' }), false);
  assert.equal(tenant.isOperator({ rol: 'operador', cliente_id: null }), true);
  assert.equal(tenant.isOperator({ rol: 'admin', cliente_id: null }), true);

  const denials = [];
  const response = {
    status(code) {
      denials.push(code);
      return this;
    },
    json() {
      return this;
    },
  };
  let called = false;
  tenant.requireOperator(
    { user: { rol: 'cliente', cliente_id: 'cli-001' } },
    response,
    () => {
      called = true;
    }
  );
  assert.equal(called, false);
  assert.deepEqual(denials, [403]);

  called = false;
  tenant.requireOperator(
    { user: { rol: 'operador', cliente_id: null } },
    response,
    () => {
      called = true;
    }
  );
  assert.equal(called, true);
});

test('el escenario de base de datos hereda cliente, empresa y sector', async () => {
  const scenario = await scheduler.buildScenarioFromDb({
    empresa: {
      id: 'emp-1',
      razon_social: 'Vigo Seguridad SpA',
      sector: 'seguridad',
      regimen_jornada: 'excepcional',
      autorizacion_excepcional: true,
    },
    cliente: {
      id: 'cli-002',
      nombre: 'Clínica Los Robles',
      razon_social: 'Clínica Los Robles SpA',
      sector: 'salud',
    },
    sucursal: { id: 'suc-1', nombre: 'Sede Providencia', ciudad: 'Providencia' },
    guardias: [],
    puestos: [],
    startDate: '2026-11-30',
    days: 28,
  });

  assert.equal(scenario.sector, 'salud');
  assert.equal(scenario.clienteId, 'cli-002');
  assert.equal(scenario.clientId, 'cli-002');
  assert.equal(scenario.clientName, 'Clínica Los Robles');
  assert.equal(scenario.operatorName, 'Vigo Seguridad SpA');
  assert.equal(scenario.company, 'Clínica Los Robles SpA');
  assert.equal(scenario.empresaId, 'emp-1');
  assert.equal(scenario.sucursalId, 'suc-1');
});
