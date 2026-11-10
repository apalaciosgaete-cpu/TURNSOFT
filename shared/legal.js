export const APP_NAME = 'TURNSOFT';
export const APP_TAGLINE = 'Turnos legales para Chile';
export const LEGAL_VERSION = 'Noviembre 2026';

export const DISCLAIMER =
  'TURNSOFT es una herramienta de apoyo a la planificación. No constituye asesoría legal ni reemplaza la revisión de contratos, convenios colectivos, reglamentos internos o autorizaciones de la Dirección del Trabajo. Los regímenes excepcionales (turnos de 12 h, ciclos 4x4, 7x7 u otros) requieren autorización y deben cumplir los límites del DS 48/2023. La jornada ordinaria vigente desde el 26-04-2026 es de 42 horas semanales; desde el 26-04-2028 será de 40 horas.';

export const WEEKLY_HOURS_MILESTONES = [
  { from: '2024-04-26', hours: 44, label: 'Ley 21.561 · primera reducción' },
  { from: '2026-04-26', hours: 42, label: 'Ley 21.561 · jornada de 42 horas' },
  { from: '2028-04-26', hours: 40, label: 'Ley 21.561 · jornada de 40 horas' },
];

export function weeklyHoursAt(dateISO) {
  const applicable = WEEKLY_HOURS_MILESTONES.filter((item) => item.from <= dateISO);
  return applicable.length ? applicable[applicable.length - 1] : { from: '', hours: 45, label: 'Jornada histórica' };
}

export function nextWeeklyHoursMilestone(dateISO) {
  return WEEKLY_HOURS_MILESTONES.find((item) => item.from > dateISO) || null;
}

export const LEGAL_SOURCES = [
  {
    id: 'ct-22',
    norm: 'Código del Trabajo',
    article: 'Artículo 22',
    title: 'Jornada ordinaria y distribución',
    summary:
      'La jornada ordinaria no puede exceder el máximo legal semanal. La distribución puede hacerse en la semana calendario o sobre la base de promedios semanales en lapsos de hasta cuatro semanas, con los límites y requisitos legales.',
    relevance:
      'Sostiene el parámetro de jornada semanal. Con la Ley 21.561, el máximo es 42 horas desde el 26-04-2026 y 40 horas desde el 26-04-2028.',
    url: 'https://www.elcriterio.cl/codigos/codigo-trabajo/articulo-22/',
    tags: ['jornada', '42 horas'],
  },
  {
    id: 'ley-21561',
    norm: 'Ley 21.561',
    article: 'Reducción gradual de la jornada',
    title: 'De 44 a 42 y luego a 40 horas',
    summary:
      'La ley redujo gradualmente la jornada ordinaria: 44 horas desde abril de 2024, 42 horas desde el 26 de abril de 2026 y 40 horas desde el 26 de abril de 2028.',
    relevance:
      'TURNSOFT usa 42 horas como valor vigente por defecto y muestra el próximo hito. El parámetro es editable para contratos o convenios más favorables.',
    url: 'https://www.dt.gob.cl/legislacion/1624/w3-propertyvalue-188980.html',
    tags: ['jornada', 'vigencia'],
  },
  {
    id: 'ct-28',
    norm: 'Código del Trabajo',
    article: 'Artículo 28',
    title: 'Límites diarios y distribución semanal',
    summary:
      'El máximo semanal no puede distribuirse en más de seis ni en menos de cinco días. En ningún caso la jornada ordinaria puede exceder de diez horas por día, sin perjuicio de las excepciones legales.',
    relevance:
      'TURNSOFT valida el tope diario y los días trabajados por semana. Un turno de 12 horas no es ordinario: requiere un régimen excepcional autorizado.',
    url: 'https://www.elcriterio.cl/codigos/codigo-trabajo/articulo-28/',
    tags: ['jornada diaria', 'días'],
  },
  {
    id: 'ct-34',
    norm: 'Código del Trabajo',
    article: 'Artículo 34',
    title: 'Colación y jornada efectiva',
    summary:
      'La jornada se divide en dos partes, con al menos media hora de colación. Ese período no se considera trabajado para computar la duración de la jornada diaria.',
    relevance:
      'TURNSOFT descuenta la colación configurada en cada plantilla para calcular las horas computables. Un turno de 9 horas con 1 hora de colación computa 8 horas.',
    url: 'https://www.elcriterio.cl/codigos/codigo-trabajo/articulo-34/',
    tags: ['colación', 'horas'],
  },
  {
    id: 'ct-35',
    norm: 'Código del Trabajo',
    article: 'Artículo 35',
    title: 'Descanso dominical y festivo',
    summary:
      'Los domingos y los días declarados festivos son de descanso, salvo respecto de las actividades autorizadas por ley para trabajar en esos días.',
    relevance:
      'Determina si una actividad puede operar domingos y festivos. TURNSOFT permite configurarlo por escenario y alerta cuando se programa trabajo no autorizado.',
    url: 'https://www.elcriterio.cl/codigos/codigo-trabajo/articulo-35/',
    tags: ['descanso', 'domingo'],
  },
  {
    id: 'ct-36',
    norm: 'Código del Trabajo',
    article: 'Artículo 36',
    title: 'Inicio y término del descanso',
    summary:
      'El descanso comienza a más tardar a las 21:00 del día anterior al domingo o festivo y termina a las 6:00 del día siguiente, con las alteraciones horarias y salvedades legales.',
    relevance:
      'Se usa como referencia para revisar el descanso semanal. En actividades exceptuadas y regímenes especiales pueden existir reglas distintas.',
    url: 'https://www.elcriterio.cl/codigos/codigo-trabajo/articulo-36/',
    tags: ['descanso', 'domingo'],
  },
  {
    id: 'ct-37',
    norm: 'Código del Trabajo',
    article: 'Artículo 37',
    title: 'Prohibición de distribuir la jornada en domingo',
    summary:
      'Las empresas o faenas no exceptuadas no pueden distribuir la jornada ordinaria de modo que incluya domingo o festivo, salvo fuerza mayor o autorización en los casos legales.',
    relevance:
      'TURNSOFT marca como error el trabajo dominical cuando el escenario no está habilitado para operar ese día.',
    url: 'https://www.elcriterio.cl/codigos/codigo-trabajo/articulo-37/',
    tags: ['domingo', 'excepciones'],
  },
  {
    id: 'ct-38',
    norm: 'Código del Trabajo',
    article: 'Artículo 38',
    title: 'Actividades exceptuadas y descanso compensatorio',
    summary:
      'Regula las actividades exceptuadas del descanso dominical, el descanso compensatorio, los domingos libres en comercio y el recargo mínimo de 30% por trabajo en domingo en los casos que indica la ley.',
    relevance:
      'Configura los domingos libres y el recargo dominical. Para retail, TURNSOFT usa 30% como valor de referencia y lo deja parametrizable.',
    url: 'https://www.elcriterio.cl/codigos/codigo-trabajo/articulo-38/',
    tags: ['domingo', 'retail', 'recargo'],
  },
  {
    id: 'ds-48',
    norm: 'Decreto Supremo N° 48/2023',
    article: 'Reglamento de jornadas excepcionales',
    title: 'Límites y parámetros de sistemas excepcionales',
    summary:
      'El reglamento determina límites y parámetros de distribución de los sistemas excepcionales de jornada y descanso, incluyendo promedios semanales y descansos adicionales.',
    relevance:
      'Sostiene los escenarios de seguridad y minería con turnos de 12 horas. TURNSOFT exige declarar la autorización y valida el promedio semanal sobre el ciclo.',
    url: 'https://www.dt.gob.cl/legislacion/1624/w3-propertyvalue-190373.html',
    tags: ['excepcional', '12 horas', 'minería', 'seguridad'],
  },
  {
    id: 'dt-excepcionales',
    norm: 'Dirección del Trabajo',
    article: 'Jornadas excepcionales de trabajo',
    title: 'Compilación normativa y criterios',
    summary:
      'La Dirección del Trabajo reúne la normativa y los pronunciamientos sobre jornadas excepcionales, incluyendo los requisitos de autorización y los límites aplicables.',
    relevance:
      'Referencia de apoyo para revisar el encuadre de los ciclos 4x4, 7x7 y otros regímenes especiales.',
    url: 'https://www.dt.gob.cl/legislacion/1624/w3-propertyvalue-193335.html',
    tags: ['excepcional', 'DT'],
  },
  {
    id: 'dt-guardias',
    norm: 'Dirección del Trabajo',
    article: 'Guardias de seguridad',
    title: 'Compilación de dictámenes sobre guardias',
    summary:
      'Reúne pronunciamientos administrativos sobre jornada, descansos y régimen excepcional aplicable a guardias de seguridad privada.',
    relevance:
      'Base de los presets de seguridad. No reemplaza la resolución de autorización de cada empresa ni el contrato colectivo aplicable.',
    url: 'https://www.dt.gob.cl/legislacion/1624/w3-propertyvalue-136992.html',
    tags: ['seguridad', 'excepcional'],
  },
  {
    id: 'res-1185',
    norm: 'Resolución Exenta N° 1185/2006',
    article: 'Sistema excepcional de guardias',
    title: 'Jornada y ciclos de descanso en seguridad',
    summary:
      'Es una referencia tradicional para el sistema excepcional de guardias de seguridad, con jornadas de hasta 12 horas y ciclos de trabajo y descanso como 4x4 o 7x7, sujeto a autorización y normativa vigente.',
    relevance:
      'Inspira el preset de seguridad, pero TURNSOFT no la aplica automáticamente: exige marcar la autorización y validar el promedio semanal.',
    url: 'https://www.dt.gob.cl/legislacion/1624/w3-propertyvalue-136992.html',
    tags: ['seguridad', '12 horas', '4x4'],
  },
  {
    id: 'ley-21659',
    norm: 'Ley 21.659',
    article: 'Seguridad privada',
    title: 'Regulación de la seguridad privada y OS-10',
    summary:
      'La ley regula la actividad de seguridad privada y las exigencias de certificación y acreditación de las personas que cumplen funciones de vigilancia.',
    relevance:
      'TURNSOFT permite asociar certificaciones con vencimiento a cada trabajador y bloquear turnos cuando la credencial exigida está vencida.',
    url: 'https://www.bcn.cl/leychile/',
    tags: ['seguridad', 'certificación', 'OS-10'],
  },
  {
    id: 'feriados-2026',
    norm: 'Gobierno de Chile',
    article: 'Feriados 2026',
    title: 'Calendario oficial de feriados',
    summary:
      'Calendario de feriados nacionales y regionales de Chile para 2026, incluyendo los irrenunciables y los trasladables.',
    relevance:
      'TURNSOFT calcula feriados nacionales para el rango planificado y permite agregar feriados regionales o internos. Verifica siempre el calendario oficial del año.',
    url: 'https://www.gob.cl/noticias/feriados-2026-revisa-cuantos-habra-y-cuales-son-irrenunciables/',
    tags: ['feriados', 'calendario'],
  },
];

export const RULE_CATALOG = [
  {
    id: 'maxWeeklyHours',
    label: 'Jornada semanal máxima',
    unit: 'h',
    group: 'Jornada',
    citation: 'Art. 22 CT · Ley 21.561',
    help: 'Máximo legal o contractual. En 2026 la jornada ordinaria es de 42 horas; en 2028 baja a 40 horas.',
  },
  {
    id: 'maxDailyHours',
    label: 'Tope diario ordinario',
    unit: 'h',
    group: 'Jornada',
    citation: 'Art. 28 CT',
    help: 'La jornada ordinaria no puede exceder 10 horas diarias. TURNSOFT usa un valor más bajo si el preset sectorial lo define.',
  },
  {
    id: 'maxDaysPerWeek',
    label: 'Días máximos por semana',
    unit: 'días',
    group: 'Jornada',
    citation: 'Art. 28 CT',
    help: 'En jornada ordinaria, la distribución semanal no puede superar 6 días. Los regímenes excepcionales se rigen por el DS 48 y la autorización aplicable.',
  },
  {
    id: 'maxConsecutiveWorkDays',
    label: 'Días consecutivos máximos',
    unit: 'días',
    group: 'Descansos',
    citation: 'Política interna · Art. 28 CT',
    help: 'Parámetro de protección. En jornada ordinaria se alinea con el máximo de 6 días por semana; en turnos excepcionales se ajusta al ciclo autorizado.',
  },
  {
    id: 'blockRestDays',
    label: 'Descanso tras bloque',
    unit: 'días',
    group: 'Descansos',
    citation: 'DS 48/2023 · política interna',
    help: 'Días de descanso que TURNSOFT intenta asegurar después de completar el bloque máximo. En 4x4 son 4; en 7x7 son 7; en 5x2 son 2.',
  },
  {
    id: 'minRestBetweenShifts',
    label: 'Descanso entre jornadas',
    unit: 'h',
    group: 'Descansos',
    citation: 'Parámetro contractual/reglamentario',
    help: 'TURNSOFT lo exige como política de seguridad, pero el Código del Trabajo no fija un mínimo general de 12 horas entre jornadas. Revisa contrato, convenio y DS 48.',
  },
  {
    id: 'minWeeklyRestHours',
    label: 'Descanso semanal mínimo',
    unit: 'h',
    group: 'Descansos',
    citation: 'Arts. 35-37 CT',
    help: 'Referencia de descanso semanal. Las actividades exceptuadas y los regímenes especiales pueden tener reglas de descanso compensatorio distintas.',
  },
  {
    id: 'minSundaysOffPerMonth',
    label: 'Domingos libres al mes',
    unit: 'domingos',
    group: 'Domingo y festivos',
    citation: 'Art. 38 CT',
    help: 'En comercio y actividades exceptuadas aplican reglas de domingos libres. Ajusta el valor según la actividad y el contrato colectivo.',
  },
  {
    id: 'sundayPremiumPercent',
    label: 'Recargo dominical',
    unit: '%',
    group: 'Domingo y festivos',
    citation: 'Art. 38 CT',
    help: 'Recargo estimado por trabajo en domingo. En comercio la referencia legal es 30% sobre el sueldo diario; otras actividades pueden tener un tratamiento distinto.',
  },
  {
    id: 'holidayPremiumPercent',
    label: 'Recargo festivo',
    unit: '%',
    group: 'Domingo y festivos',
    citation: 'Contrato / normativa especial',
    help: 'TURNSOFT solo estima el recargo configurado. Verifica el contrato, convenio colectivo y normativa sectorial aplicable.',
  },
  {
    id: 'maxExceptionalAverageWeeklyHours',
    label: 'Promedio semanal excepcional',
    unit: 'h',
    group: 'Régimen excepcional',
    citation: 'DS 48/2023',
    help: 'Promedio máximo sobre el ciclo autorizado. En 2026 no puede superar la jornada ordinaria vigente (42 h), salvo reglas especiales.',
  },
  {
    id: 'maxExceptionalDailyHours',
    label: 'Tope diario excepcional',
    unit: 'h',
    group: 'Régimen excepcional',
    citation: 'DS 48/2023 · autorización DT',
    help: 'TURNSOFT usa este tope solo cuando el escenario está marcado como excepcional y autorizado. No habilita por sí solo un turno de 12 horas.',
  },
  {
    id: 'maxConsecutiveNightShifts',
    label: 'Noches consecutivas máximas',
    unit: 'noches',
    group: 'Nocturnidad',
    citation: 'Política interna / normativa sectorial',
    help: 'No existe un tope general uniforme en el Código del Trabajo. Ajusta según el contrato, convenio y regulación sectorial.',
  },
];

export const SECTOR_META = {
  seguridad: {
    id: 'seguridad',
    label: 'Seguridad privada',
    short: 'Seguridad',
    description: 'Guardias, conserjería y vigilancia con ciclos 4x4 o 7x7 y certificación OS-10.',
    icon: 'shield',
    accent: '#34d399',
    tint: '#e7f8f0',
    examples: '4x4 · 12 h · OS-10',
  },
  salud: {
    id: 'salud',
    label: 'Salud',
    short: 'Salud',
    description: 'Equipos clínicos con turnos de mañana, tarde y noche, y credenciales profesionales.',
    icon: 'heart',
    accent: '#60a5fa',
    tint: '#eaf2ff',
    examples: '5x2 · 8 h · registro profesional',
  },
  mineria: {
    id: 'mineria',
    label: 'Minería',
    short: 'Minería',
    description: 'Faenas con ciclos 7x7 o 4x4, turnos de 12 horas y certificaciones de seguridad.',
    icon: 'mountain',
    accent: '#fbbf24',
    tint: '#fff7e2',
    examples: '7x7 · 12 h · DS 48',
  },
  retail: {
    id: 'retail',
    label: 'Retail y comercio',
    short: 'Retail',
    description: 'Tiendas con cobertura de fin de semana, domingos libres y recargo dominical.',
    icon: 'store',
    accent: '#f472b6',
    tint: '#fdeef6',
    examples: '5x2 · 8 h · 2 domingos libres',
  },
  logistica: {
    id: 'logistica',
    label: 'Logística y operaciones',
    short: 'Logística',
    description: 'Bodegas y centros de distribución con jornada ordinaria y descanso dominical.',
    icon: 'truck',
    accent: '#a78bfa',
    tint: '#f1edff',
    examples: '5x2 · 8 h · domingo libre',
  },
};

export const RULES_PRESET_BASE = {
  regime: 'ordinaria',
  maxWeeklyHours: 42,
  maxDailyHours: 10,
  maxExceptionalDailyHours: 12,
  maxExceptionalAverageWeeklyHours: 42,
  maxDaysPerWeek: 6,
  maxConsecutiveWorkDays: 6,
  blockRestDays: 1,
  minRestBetweenShifts: 12,
  minWeeklyRestHours: 24,
  minSundaysOffPerMonth: 0,
  sundayPremiumPercent: 0,
  holidayPremiumPercent: 0,
  allowSundayWork: false,
  allowHolidayWork: false,
  exceptionalAuthorized: false,
  exceptionalReference: '',
  maxConsecutiveNightShifts: 6,
  requireCertifications: true,
  requireFullCoverage: true,
};
