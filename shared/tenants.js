import { createDemoScenarios, DEMO_START_DATE } from './demo.js';

/**
 * Cuentas demo de TURNSOFT.
 *
 * `Vigo Seguridad` es la empresa operadora. Cada cliente es una cuenta
 * independiente: sus usuarios solo pueden ver sus propios escenarios,
 * sucursales y dotación. El operador puede ver y administrar a todos.
 */
export const OPERATOR = {
  id: 'emp-vigo',
  name: 'Vigo Seguridad',
  legalName: 'Vigo Seguridad SpA',
  rut: '76.543.210-8',
  email: 'operador@vigoseguridad.cl',
  phone: '+56 2 2345 6789',
  address: 'Av. Apoquindo 4501, Las Condes',
  city: 'Santiago',
  color: '#0f766e',
};

export const CLIENTS = [
  {
    id: 'cli-001',
    name: 'Condominio Parque Oriente',
    legalName: 'Comunidad Edificio Parque Oriente',
    sector: 'seguridad',
    contact: 'María José Rivas',
    email: 'administracion@parqueoriente.cl',
    phone: '+56 9 1111 1111',
    address: 'Av. Las Condes 11200',
    city: 'Santiago',
    color: '#0f766e',
    active: true,
  },
  {
    id: 'cli-002',
    name: 'Clínica Los Robles',
    legalName: 'Clínica Los Robles SpA',
    sector: 'salud',
    contact: 'Paula Contreras',
    email: 'operaciones@clinicalosrobles.cl',
    phone: '+56 9 2222 2222',
    address: 'Av. Providencia 2345',
    city: 'Providencia',
    color: '#0284c7',
    active: true,
  },
  {
    id: 'cli-003',
    name: 'Faena Atacama Norte',
    legalName: 'Andes Minerals SpA',
    sector: 'mineria',
    contact: 'Rodrigo Álvarez',
    email: 'operaciones@andesminerals.cl',
    phone: '+56 9 3333 3333',
    address: 'Ruta C-35 km 18',
    city: 'Copiapó',
    color: '#b45309',
    active: true,
  },
  {
    id: 'cli-004',
    name: 'Mall Plaza del Sur',
    legalName: 'Plaza del Sur Retail SpA',
    sector: 'retail',
    contact: 'Daniela Vega',
    email: 'gerencia@plazadelsur.cl',
    phone: '+56 9 4444 4444',
    address: 'Av. Los Carrera 780',
    city: 'Concepción',
    color: '#db2777',
    active: true,
  },
  {
    id: 'cli-005',
    name: 'Centro de Distribución Quilicura',
    legalName: 'Ruta Clara Logística SpA',
    sector: 'logistica',
    contact: 'Marcela Ortiz',
    email: 'operaciones@rutaclara.cl',
    phone: '+56 9 5555 5555',
    address: 'Panamericana Norte 9850',
    city: 'Quilicura',
    color: '#7c3aed',
    active: true,
  },
  {
    id: 'cli-006',
    name: 'Industria Cerámica Norte',
    legalName: 'Cerámica Norte SpA',
    sector: 'seguridad',
    contact: 'Cristóbal Pérez',
    email: 'planta@ceramicanorte.cl',
    phone: '+56 9 6666 6666',
    address: 'Parque Industrial La Negra',
    city: 'Antofagasta',
    color: '#0e7490',
    active: true,
  },
  {
    id: 'cli-007',
    name: 'Tienda Costanera',
    legalName: 'Costanera Retail SpA',
    sector: 'retail',
    contact: 'Josefa Campos',
    email: 'tienda@costanera.cl',
    phone: '+56 9 7777 7777',
    address: 'Av. San Martín 199',
    city: 'Viña del Mar',
    color: '#059669',
    active: true,
  },
  {
    id: 'cli-008',
    name: 'Hospital Regional Maule',
    legalName: 'Servicio de Salud Maule',
    sector: 'salud',
    contact: 'Antonia Vega',
    email: 'direccion@hospitalmaule.cl',
    phone: '+56 9 8888 8888',
    address: 'Av. San Miguel 3600',
    city: 'Talca',
    color: '#4338ca',
    active: true,
  },
];

const SECTOR_FALLBACK = 'seguridad';

function namespaceScenario(template, client) {
  const shifts = template.shifts.map((shift) => ({
    ...shift,
    id: `${client.id}-${shift.id}`,
    requiredCertifications: [...(shift.requiredCertifications || [])],
  }));
  const shiftIdMap = new Map(template.shifts.map((shift, index) => [shift.id, shifts[index].id]));

  const employees = template.employees.map((employee) => ({
    ...employee,
    id: `${client.id}-${employee.id}`,
    preferredShiftIds: (employee.preferredShiftIds || [])
      .map((shiftId) => shiftIdMap.get(shiftId))
      .filter(Boolean),
    certifications: (employee.certifications || []).map((certification) => ({
      ...certification,
      id: `${client.id}-${certification.id}`,
    })),
  }));

  return {
    ...template,
    id: `sc-${client.id}`,
    name: `Operación ${client.name}`,
    company: client.legalName || client.name,
    location: [client.address, client.city].filter(Boolean).join(', '),
    clientId: client.id,
    clientName: client.name,
    operatorName: OPERATOR.name,
    startDate: DEMO_START_DATE,
    days: 28,
    shifts,
    employees,
    schedule: null,
    notes: `${client.sector === 'seguridad' ? 'Servicio de seguridad' : 'Operación'} para ${client.name}. ${template.notes || ''}`.trim(),
    createdAt: '2026-11-01T09:00:00.000Z',
  };
}

export function createClientScenarios() {
  const templates = createDemoScenarios();
  return CLIENTS.map((client) => {
    const template =
      templates.find((scenario) => scenario.sector === client.sector) ||
      templates.find((scenario) => scenario.sector === SECTOR_FALLBACK) ||
      templates[0];
    return namespaceScenario(template, client);
  });
}

export function createTenantDemoState() {
  const scenarios = createClientScenarios();
  return {
    version: 3,
    operator: OPERATOR,
    clients: CLIENTS.map((client) => ({ ...client })),
    scenarios,
    activeScenarioId: scenarios[0]?.id || null,
    activeClientId: null,
  };
}

export const DEMO_PASSWORD = 'demo1234';

export function getDemoAccounts() {
  return [
    {
      id: 'user-operador',
      email: 'operador@vigoseguridad.cl',
      name: OPERATOR.name,
      role: 'operador',
      clientId: null,
      clientName: null,
      password: DEMO_PASSWORD,
    },
    ...CLIENTS.map((client, index) => ({
      id: `user-${client.id}`,
      email: `cliente${index + 1}@vigoseguridad.cl`,
      name: client.contact || client.name,
      role: 'cliente',
      clientId: client.id,
      clientName: client.name,
      password: DEMO_PASSWORD,
    })),
  ];
}

export function getClientById(clientId) {
  return CLIENTS.find((client) => client.id === clientId) || null;
}
