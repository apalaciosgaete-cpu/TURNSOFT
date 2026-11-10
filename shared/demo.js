import { getSectorRules, getSectorShifts, SECTOR_ENGINE_PRESETS } from './presets.js';

export const DEMO_START_DATE = '2026-11-30';
export const DEMO_DAYS = 28;

const COLORS = ['#0f766e', '#0284c7', '#7c3aed', '#db2777', '#b45309', '#059669', '#dc2626', '#475569'];

function certification(id, name, expiresAt, issuer = '') {
  return { id, name, expiresAt, issuer };
}

function employee(id, name, role, weeklyContractHours, certifications = [], options = {}) {
  return {
    id,
    name,
    role,
    weeklyContractHours,
    active: true,
    certifications,
    unavailableWeekdays: [],
    preferredShiftIds: [],
    color: options.color || COLORS[Number(id.replace(/\D/g, '')) % COLORS.length],
    phone: options.phone || '',
    startDate: options.startDate || '2025-03-01',
    ...options,
  };
}

function scenario(data) {
  const engine = SECTOR_ENGINE_PRESETS[data.sector] || SECTOR_ENGINE_PRESETS.logistica;
  return {
    id: data.id,
    name: data.name,
    company: data.company,
    location: data.location,
    sector: data.sector,
    startDate: data.startDate || DEMO_START_DATE,
    days: data.days || DEMO_DAYS,
    employees: data.employees,
    shifts: getSectorShifts(data.sector),
    rules: getSectorRules(data.sector),
    holidays: data.holidays || [],
    regions: data.regions || [],
    schedule: null,
    pattern: engine.pattern,
    continuityBias: engine.continuityBias,
    notes: data.notes || '',
    createdAt: '2026-11-05T09:00:00.000Z',
  };
}

function securityScenario() {
  const os10 = (id, expiresAt) => [certification(id, 'OS-10', expiresAt, 'Carabineros de Chile')];
  return scenario({
    id: 'sc-seguridad',
    name: 'Condominio Parque · Santiago',
    company: 'Vigía Austral SpA',
    location: 'Santiago, Región Metropolitana',
    sector: 'seguridad',
    days: 32,
    notes: 'Ciclo 4x4 con dos puestos de 12 h (día y noche). Requiere autorización de la Dirección del Trabajo y OS-10 vigente. El período demo cubre 4 ciclos completos.',
    employees: [
      employee('seg-e1', 'Camila Rojas', 'Guardia de seguridad', 42, os10('seg-c1', '2027-05-31'), { preferredShiftIds: ['seg-d12'] }),
      employee('seg-e2', 'Diego Fuentes', 'Guardia de seguridad', 42, os10('seg-c2', '2027-08-31'), { preferredShiftIds: ['seg-n12'] }),
      employee('seg-e3', 'Valentina Soto', 'Guardia de seguridad', 42, os10('seg-c3', '2026-12-31')),
      employee('seg-e4', 'Matías Herrera', 'Guardia de seguridad', 42, os10('seg-c4', '2027-03-31'), { preferredShiftIds: ['seg-n12'] }),
      employee('seg-e5', 'Javiera Muñoz', 'Guardia de seguridad', 42, os10('seg-c5', '2027-06-30')),
      employee('seg-e6', 'Cristóbal Pérez', 'Guardia de seguridad', 42, os10('seg-c6', '2027-09-30'), { preferredShiftIds: ['seg-d12'] }),
      employee('seg-e7', 'Fernanda Silva', 'Guardia de seguridad', 42, os10('seg-c7', '2027-01-31')),
      employee('seg-e8', 'Ignacio Araya', 'Guardia de seguridad', 42, os10('seg-c8', '2027-11-30')),
    ],
  });
}

function healthScenario() {
  const credentials = (id) => [
    certification(`${id}-reg`, 'Registro profesional', '2028-12-31', 'Superintendencia de Salud'),
    certification(`${id}-bls`, 'BLS', '2027-06-30', 'American Heart Association'),
  ];
  return scenario({
    id: 'sc-salud',
    name: 'Clínica Los Robles · Providencia',
    company: 'Red Salud Los Robles',
    location: 'Providencia, Región Metropolitana',
    sector: 'salud',
    notes: 'Cobertura clínica de 7 días en mañana, tarde y noche. Turnos de 8 h computables con 1 h de colación.',
    employees: [
      employee('sal-e1', 'Antonia Vega', 'Médica de turno', 40, credentials('sal-c1')),
      employee('sal-e2', 'Paula Contreras', 'Enfermera jefe', 40, credentials('sal-c2'), { preferredShiftIds: ['sal-m'] }),
      employee('sal-e3', 'Tomás Salinas', 'Enfermero', 40, credentials('sal-c3')),
      employee('sal-e4', 'María José Rivas', 'TENS', 40, credentials('sal-c4')),
      employee('sal-e5', 'Benjamín Castro', 'TENS', 40, credentials('sal-c5')),
      employee('sal-e6', 'Constanza Leiva', 'TENS', 40, credentials('sal-c6')),
      employee('sal-e7', 'Andrés Molina', 'Kinesiólogo', 40, credentials('sal-c7')),
    ],
  });
}

function miningScenario() {
  const credentials = (id) => [
    certification(`${id}-min`, 'Seguridad minera', '2027-12-31', 'Sernageomin'),
    certification(`${id}-ds48`, 'Inducción DS 48', '2027-06-30', 'Mutual de Seguridad'),
  ];
  return scenario({
    id: 'sc-mineria',
    name: 'Faena Atacama Norte · Copiapó',
    company: 'Andes Minerals SpA',
    location: 'Copiapó, Región de Atacama',
    sector: 'mineria',
    notes: 'Ciclo 7x7 en faena con turnos de 12 h. Requiere autorización DT, DS 48 y certificaciones de seguridad minera.',
    employees: [
      employee('min-e1', 'Rodrigo Álvarez', 'Operador de faena', 42, credentials('min-c1')),
      employee('min-e2', 'Francisca Núñez', 'Operadora de faena', 42, credentials('min-c2'), { preferredShiftIds: ['min-d12'] }),
      employee('min-e3', 'Sebastián Cárdenas', 'Mantenedor mecánico', 42, credentials('min-c3')),
      employee('min-e4', 'Isidora Paredes', 'Supervisora de turno', 42, credentials('min-c4')),
      employee('min-e5', 'Nicolás Guerrero', 'Operador de faena', 42, credentials('min-c5'), { preferredShiftIds: ['min-n12'] }),
      employee('min-e6', 'Catalina Espinoza', 'Operadora de faena', 42, credentials('min-c6')),
      employee('min-e7', 'Felipe Oliva', 'Mantenedor eléctrico', 42, credentials('min-c7')),
      employee('min-e8', 'Rocío Fuentealba', 'Operadora de faena', 42, credentials('min-c8')),
    ],
  });
}

function retailScenario() {
  return scenario({
    id: 'sc-retail',
    name: 'Tienda Centro · Concepción',
    company: 'Casa Sur Retail',
    location: 'Concepción, Región del Biobío',
    sector: 'retail',
    notes: 'Tienda con cobertura de domingo y festivos. Recargo dominical de referencia 30% y al menos 2 domingos libres al mes.',
    employees: [
      employee('ret-e1', 'Daniela Vega', 'Jefa de tienda', 40, [], { preferredShiftIds: ['ret-a'] }),
      employee('ret-e2', 'Jorge Medina', 'Vendedor', 40),
      employee('ret-e3', 'Paz Herrera', 'Vendedora', 40, [], { preferredShiftIds: ['ret-a'] }),
      employee('ret-e4', 'Lucas Bravo', 'Reponedor', 40),
      employee('ret-e5', 'Magdalena Ríos', 'Vendedora', 40),
      employee('ret-e6', 'Vicente Lagos', 'Reponedor', 40),
      employee('ret-e7', 'Josefa Campos', 'Vendedora', 40, [], { preferredShiftIds: ['ret-c'] }),
    ],
  });
}

function logisticsScenario() {
  return scenario({
    id: 'sc-logistica',
    name: 'Centro de distribución · Quilicura',
    company: 'Ruta Clara Logística',
    location: 'Quilicura, Región Metropolitana',
    sector: 'logistica',
    notes: 'Centro de distribución cerrado domingo y festivos. Jornada ordinaria con turnos de día y tarde.',
    employees: [
      employee('log-e1', 'Marcela Ortiz', 'Supervisora de turno', 36, [], { preferredShiftIds: ['log-d'] }),
      employee('log-e2', 'Bruno Salazar', 'Operador de bodega', 36),
      employee('log-e3', 'Elisa Fuentes', 'Operadora de bodega', 36),
      employee('log-e4', 'Héctor Pino', 'Chofer', 36),
      employee('log-e5', 'Trinidad Mora', 'Operadora de bodega', 36),
      employee('log-e6', 'Simón Valdés', 'Operador de bodega', 36),
      employee('log-e7', 'Amanda Torres', 'Analista de inventario', 36),
    ],
  });
}

export function createDemoScenarios() {
  return [
    securityScenario(),
    healthScenario(),
    miningScenario(),
    retailScenario(),
    logisticsScenario(),
  ];
}

export function createDemoState() {
  const scenarios = createDemoScenarios();
  return {
    version: 2,
    activeScenarioId: scenarios[0].id,
    scenarios,
  };
}
