/**
 * Datos demo multi-tenant de TURNSOFT.
 *
 * Crea la empresa operadora Vigo Seguridad, sus 8 clientes y una operación
 * completa por cliente (sucursal, puestos, dotación y usuario de acceso).
 * Es idempotente: se puede ejecutar más de una vez.
 */
const path = require('path');
const { pathToFileURL } = require('url');
const pool = require('./config/db');
const { hashPassword } = require('./utils/password');

let tenantsPromise = null;

function loadTenants() {
  if (!tenantsPromise) {
    const file = path.resolve(__dirname, '../../shared/tenants.js');
    tenantsPromise = import(pathToFileURL(file).href);
  }
  return tenantsPromise;
}

const PLANTILLAS = [
  {
    nombre: 'Día 12 h',
    codigo: 'D12',
    duracion_horas: 12,
    hora_inicio: '08:00',
    hora_fin: '20:00',
    requiere_colacion: true,
    minutos_colacion: 60,
    es_nocturno: false,
    color: '#0f766e',
    cobertura_semanal: [1, 1, 1, 1, 1, 1, 1],
    certificaciones_requeridas: ['OS-10'],
  },
  {
    nombre: 'Noche 12 h',
    codigo: 'N12',
    duracion_horas: 12,
    hora_inicio: '20:00',
    hora_fin: '08:00',
    requiere_colacion: true,
    minutos_colacion: 60,
    es_nocturno: true,
    color: '#4338ca',
    cobertura_semanal: [1, 1, 1, 1, 1, 1, 1],
    certificaciones_requeridas: ['OS-10'],
  },
  {
    nombre: 'Mañana 8 h',
    codigo: 'M8',
    duracion_horas: 8,
    hora_inicio: '08:00',
    hora_fin: '16:00',
    requiere_colacion: true,
    minutos_colacion: 30,
    es_nocturno: false,
    color: '#0284c7',
    cobertura_semanal: [1, 1, 1, 1, 1, 1, 1],
    certificaciones_requeridas: [],
  },
  {
    nombre: 'Tarde 8 h',
    codigo: 'T8',
    duracion_horas: 8,
    hora_inicio: '16:00',
    hora_fin: '00:00',
    requiere_colacion: true,
    minutos_colacion: 30,
    es_nocturno: false,
    color: '#7c3aed',
    cobertura_semanal: [1, 1, 1, 1, 1, 1, 1],
    certificaciones_requeridas: [],
  },
  {
    nombre: 'Noche 8 h',
    codigo: 'N8',
    duracion_horas: 8,
    hora_inicio: '00:00',
    hora_fin: '08:00',
    requiere_colacion: true,
    minutos_colacion: 30,
    es_nocturno: true,
    color: '#1e3a8a',
    cobertura_semanal: [1, 1, 1, 1, 1, 1, 1],
    certificaciones_requeridas: [],
  },
  {
    nombre: 'Retail apertura',
    codigo: 'R9',
    duracion_horas: 9,
    hora_inicio: '09:00',
    hora_fin: '18:00',
    requiere_colacion: true,
    minutos_colacion: 60,
    es_nocturno: false,
    color: '#db2777',
    cobertura_semanal: [1, 1, 1, 1, 1, 1, 1],
    certificaciones_requeridas: [],
  },
  {
    nombre: 'Retail cierre',
    codigo: 'R14',
    duracion_horas: 8,
    hora_inicio: '14:00',
    hora_fin: '22:00',
    requiere_colacion: true,
    minutos_colacion: 30,
    es_nocturno: false,
    color: '#b45309',
    cobertura_semanal: [1, 1, 1, 1, 1, 1, 1],
    certificaciones_requeridas: [],
  },
  {
    nombre: 'Logística turno A',
    codigo: 'L06',
    duracion_horas: 8,
    hora_inicio: '06:00',
    hora_fin: '14:00',
    requiere_colacion: true,
    minutos_colacion: 30,
    es_nocturno: false,
    color: '#059669',
    cobertura_semanal: [1, 1, 1, 1, 1, 1, 1],
    certificaciones_requeridas: [],
  },
  {
    nombre: 'Logística turno B',
    codigo: 'L14',
    duracion_horas: 8,
    hora_inicio: '14:00',
    hora_fin: '22:00',
    requiere_colacion: true,
    minutos_colacion: 30,
    es_nocturno: false,
    color: '#0e7490',
    cobertura_semanal: [1, 1, 1, 1, 1, 1, 1],
    certificaciones_requeridas: [],
  },
  {
    nombre: 'Logística turno C',
    codigo: 'L22',
    duracion_horas: 8,
    hora_inicio: '22:00',
    hora_fin: '06:00',
    requiere_colacion: true,
    minutos_colacion: 30,
    es_nocturno: true,
    color: '#475569',
    cobertura_semanal: [1, 1, 1, 1, 1, 1, 1],
    certificaciones_requeridas: [],
  },
];

const OPERACIONES = {
  seguridad: {
    cargo: 'Guardia de seguridad',
    puesto: 'Puesto',
    certificaciones: ['OS-10'],
    puestos: [
      { plantilla: 'D12', nombre: 'Puesto diurno', coverage: [2, 2, 2, 2, 2, 2, 2], minima: 2 },
      { plantilla: 'N12', nombre: 'Puesto nocturno', coverage: [2, 2, 2, 2, 2, 2, 2], minima: 2 },
    ],
  },
  salud: {
    cargo: 'Técnico/a en enfermería',
    puesto: 'Puesto',
    certificaciones: [],
    puestos: [
      { plantilla: 'M8', nombre: 'Puesto mañana', coverage: [1, 1, 1, 1, 1, 1, 1], minima: 1 },
      { plantilla: 'T8', nombre: 'Puesto tarde', coverage: [1, 1, 1, 1, 1, 1, 1], minima: 1 },
      { plantilla: 'N8', nombre: 'Puesto noche', coverage: [1, 1, 1, 1, 1, 1, 1], minima: 1 },
    ],
  },
  mineria: {
    cargo: 'Operador/a de planta',
    puesto: 'Puesto',
    certificaciones: [],
    puestos: [
      { plantilla: 'D12', nombre: 'Puesto diurno', coverage: [2, 2, 2, 2, 2, 2, 2], minima: 2 },
      { plantilla: 'N12', nombre: 'Puesto nocturno', coverage: [2, 2, 2, 2, 2, 2, 2], minima: 2 },
    ],
  },
  retail: {
    cargo: 'Vendedor/a',
    puesto: 'Puesto',
    certificaciones: [],
    puestos: [
      { plantilla: 'R9', nombre: 'Puesto apertura', coverage: [1, 1, 1, 1, 1, 1, 1], minima: 1 },
      { plantilla: 'R14', nombre: 'Puesto cierre', coverage: [1, 1, 1, 1, 1, 1, 1], minima: 1 },
    ],
  },
  logistica: {
    cargo: 'Operario/a logístico',
    puesto: 'Puesto',
    certificaciones: [],
    puestos: [
      { plantilla: 'L06', nombre: 'Puesto turno A', coverage: [1, 1, 1, 1, 1, 1, 1], minima: 1 },
      { plantilla: 'L14', nombre: 'Puesto turno B', coverage: [1, 1, 1, 1, 1, 1, 1], minima: 1 },
      { plantilla: 'L22', nombre: 'Puesto turno C', coverage: [1, 1, 1, 1, 1, 1, 1], minima: 1 },
    ],
  },
};

const NOMBRES = [
  'Camila Rojas', 'Diego Fuentes', 'Valentina Soto', 'Matías Herrera',
  'Javiera Muñoz', 'Cristóbal Pérez', 'Fernanda Silva', 'Ignacio Araya',
  'Antonia Vega', 'Sebastián Lara', 'Martina Fuentes', 'Tomás Riquelme',
  'Isidora Campos', 'Vicente Salas', 'Catalina Pino', 'Benjamín Torres',
  'Emilia Cáceres', 'Gaspar Núñez', 'Florencia Aguirre', 'Renato Silva',
  'Trinidad Vergara', 'Lucas Espinoza', 'Amanda Leiva', 'Joaquín Reyes',
  'Constanza Bravo', 'Felipe Sandoval', 'Josefa Molina', 'Bruno Castillo',
  'Magdalena Ríos', 'Ángel Sepúlveda', 'Pía Montoya', 'Damián Cárdenas',
  'Rocío Herrera', 'Maximiliano Pinto', 'Elena Farías', 'Nicolás Cortés',
  'Daniela Paredes', 'Andrés Gallardo', 'Sofía Valdés', 'Rodrigo Álvarez',
];

function clientRut(index) {
  const block = String(100 + index).padStart(3, '0');
  return `76.${block}.${block}-${(index + 1) % 10}`;
}

function guardRut(clientIndex, guardIndex) {
  const first = String(100 + guardIndex).padStart(3, '0');
  const second = String(100 + clientIndex * 10 + guardIndex).padStart(3, '0');
  return `9${clientIndex + 1}.${first}.${second}-${(clientIndex + guardIndex) % 10}`;
}

async function upsertPlantilla(client, data) {
  const existing = await client.query(
    'SELECT id FROM turno_plantillas WHERE codigo = $1 ORDER BY creado_en LIMIT 1',
    [data.codigo]
  );
  if (existing.rows.length) {
    await client.query(
      `UPDATE turno_plantillas
       SET nombre = $1, duracion_horas = $2, hora_inicio = $3, hora_fin = $4,
           requiere_colacion = $5, minutos_colacion = $6, es_nocturno = $7,
           color = $8, cobertura_semanal = $9, certificaciones_requeridas = $10
       WHERE id = $11`,
      [
        data.nombre,
        data.duracion_horas,
        data.hora_inicio,
        data.hora_fin,
        data.requiere_colacion,
        data.minutos_colacion,
        data.es_nocturno,
        data.color,
        data.cobertura_semanal,
        data.certificaciones_requeridas,
        existing.rows[0].id,
      ]
    );
    return existing.rows[0].id;
  }

  const inserted = await client.query(
    `INSERT INTO turno_plantillas
       (nombre, codigo, duracion_horas, hora_inicio, hora_fin, requiere_colacion,
        minutos_colacion, es_nocturno, color, cobertura_semanal, certificaciones_requeridas)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id`,
    [
      data.nombre,
      data.codigo,
      data.duracion_horas,
      data.hora_inicio,
      data.hora_fin,
      data.requiere_colacion,
      data.minutos_colacion,
      data.es_nocturno,
      data.color,
      data.cobertura_semanal,
      data.certificaciones_requeridas,
    ]
  );
  return inserted.rows[0].id;
}

async function upsertSucursal(client, { empresaId, clienteId, nombre, direccion, ciudad }) {
  const existing = await client.query(
    `SELECT id FROM sucursales
     WHERE empresa_id = $1 AND cliente_id = $2 AND nombre = $3
     LIMIT 1`,
    [empresaId, clienteId, nombre]
  );
  if (existing.rows.length) {
    await client.query('UPDATE sucursales SET direccion = $1, ciudad = $2 WHERE id = $3', [
      direccion || null,
      ciudad || null,
      existing.rows[0].id,
    ]);
    return existing.rows[0].id;
  }

  const inserted = await client.query(
    `INSERT INTO sucursales (empresa_id, cliente_id, nombre, direccion, ciudad)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [empresaId, clienteId, nombre, direccion || null, ciudad || null]
  );
  return inserted.rows[0].id;
}

async function upsertPuesto(client, { sucursalId, nombre, plantillaId, minima, coverage, certifications }) {
  const existing = await client.query(
    'SELECT id FROM puestos WHERE sucursal_id = $1 AND nombre = $2 LIMIT 1',
    [sucursalId, nombre]
  );
  if (existing.rows.length) {
    await client.query(
      `UPDATE puestos
       SET minima_cobertura = $1, turno_plantilla_id = $2,
           cobertura_semanal = $3, certificaciones_requeridas = $4
       WHERE id = $5`,
      [minima, plantillaId, coverage, certifications, existing.rows[0].id]
    );
    return existing.rows[0].id;
  }

  const inserted = await client.query(
    `INSERT INTO puestos
       (sucursal_id, nombre, minima_cobertura, turno_plantilla_id,
        cobertura_semanal, certificaciones_requeridas)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [sucursalId, nombre, minima, plantillaId, coverage, certifications]
  );
  return inserted.rows[0].id;
}

async function upsertGuardia(client, data) {
  const existing = await client.query(
    'SELECT id FROM guardias WHERE empresa_id = $1 AND rut = $2 LIMIT 1',
    [data.empresaId, data.rut]
  );

  let guardiaId;
  if (existing.rows.length) {
    guardiaId = existing.rows[0].id;
    await client.query(
      `UPDATE guardias
       SET cliente_id = $1, nombre_completo = $2, email = $3, telefono = $4,
           fecha_contrato = $5, horas_semanales_max = $6, cargo = $7,
           activo = TRUE, actualizado_en = NOW()
       WHERE id = $8`,
      [
        data.clienteId,
        data.nombre,
        data.email,
        data.telefono,
        data.fechaContrato,
        data.horasSemanales,
        data.cargo,
        guardiaId,
      ]
    );
  } else {
    const inserted = await client.query(
      `INSERT INTO guardias
         (empresa_id, cliente_id, nombre_completo, rut, email, telefono,
          fecha_contrato, horas_semanales_max, cargo, activo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE)
       RETURNING id`,
      [
        data.empresaId,
        data.clienteId,
        data.nombre,
        data.rut,
        data.email,
        data.telefono,
        data.fechaContrato,
        data.horasSemanales,
        data.cargo,
      ]
    );
    guardiaId = inserted.rows[0].id;
  }

  if (data.certificaciones?.length) {
    const cert = await client.query(
      'SELECT id FROM certificaciones_os10 WHERE guardia_id = $1 LIMIT 1',
      [guardiaId]
    );
    if (cert.rows.length) {
      await client.query(
        `UPDATE certificaciones_os10
         SET numero_certificado = $1, fecha_vencimiento = $2, emitido_por = $3
         WHERE id = $4`,
        [data.numeroCertificado, data.vencimiento, 'OS-10 Carabineros de Chile', cert.rows[0].id]
      );
    } else {
      await client.query(
        `INSERT INTO certificaciones_os10
           (guardia_id, numero_certificado, fecha_vencimiento, emitido_por)
         VALUES ($1,$2,$3,$4)`,
        [guardiaId, data.numeroCertificado, data.vencimiento, 'OS-10 Carabineros de Chile']
      );
    }
  }

  return guardiaId;
}

async function upsertUsuario(client, { empresaId, clienteId, nombre, email, rol, password }) {
  const passwordHash = hashPassword(password);
  const result = await client.query(
    `INSERT INTO usuarios
       (empresa_id, cliente_id, nombre, email, password_hash, rol, activo)
     VALUES ($1,$2,$3,$4,$5,$6,TRUE)
     ON CONFLICT (email) DO UPDATE SET
       empresa_id = EXCLUDED.empresa_id,
       cliente_id = EXCLUDED.cliente_id,
       nombre = EXCLUDED.nombre,
       password_hash = EXCLUDED.password_hash,
       rol = EXCLUDED.rol,
       activo = TRUE,
       actualizado_en = NOW()
     RETURNING id`,
    [empresaId, clienteId || null, nombre, email, passwordHash, rol]
  );
  return result.rows[0].id;
}

async function main() {
  const { OPERATOR, CLIENTS, getDemoAccounts } = await loadTenants();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const empresaResult = await client.query(
      `INSERT INTO empresas
         (razon_social, rut_empresa, sector, regimen_jornada, autorizacion_excepcional,
          referencia_autorizacion, notas, jornada_maxima_semanal,
          descanso_minimo_entre_turnos, recargo_dominical_festivo)
       VALUES ($1,$2,'seguridad','excepcional',TRUE,$3,$4,42,12,30.00)
       ON CONFLICT (rut_empresa) DO UPDATE SET
         razon_social = EXCLUDED.razon_social,
         sector = EXCLUDED.sector,
         regimen_jornada = EXCLUDED.regimen_jornada,
         autorizacion_excepcional = EXCLUDED.autorizacion_excepcional,
         referencia_autorizacion = EXCLUDED.referencia_autorizacion,
         notas = EXCLUDED.notas,
         actualizado_en = NOW()
       RETURNING id`,
      [
        OPERATOR.legalName || OPERATOR.name,
        OPERATOR.rut || '76.543.210-8',
        'Res. Ex. 1185/2006 · autorización DT (demo)',
        'Empresa operadora demo TURNSOFT: administra servicios para ocho clientes con cuentas aisladas.',
      ]
    );
    const empresaId = empresaResult.rows[0].id;

    await client.query(
      `INSERT INTO configuracion_legal
         (empresa_id, jornada_maxima_semanal, descanso_minimo_entre_turnos,
          horas_extras_max_diarias, recargo_dominical_festivo, max_daily_hours,
          max_exceptional_daily_hours, max_exceptional_average_weekly_hours,
          max_consecutive_work_days, block_rest_days, min_sundays_off_per_month,
          max_consecutive_night_shifts, allow_sunday_work, allow_holiday_work,
          require_certifications, require_full_coverage, recargo_festivo)
       VALUES ($1,42,12,2,30.00,10,12,42,4,4,1,4,TRUE,TRUE,FALSE,TRUE,30.00)
       ON CONFLICT (empresa_id) DO UPDATE SET
         jornada_maxima_semanal = 42,
         descanso_minimo_entre_turnos = 12,
         horas_extras_max_diarias = 2,
         recargo_dominical_festivo = 30.00,
         max_daily_hours = 10,
         max_exceptional_daily_hours = 12,
         max_exceptional_average_weekly_hours = 42,
         max_consecutive_work_days = 4,
         block_rest_days = 4,
         min_sundays_off_per_month = 1,
         max_consecutive_night_shifts = 4,
         allow_sunday_work = TRUE,
         allow_holiday_work = TRUE,
         require_certifications = FALSE,
         require_full_coverage = TRUE,
         recargo_festivo = 30.00,
         actualizado_en = NOW()`,
      [empresaId]
    );

    const plantillaIds = {};
    for (const plantilla of PLANTILLAS) {
      plantillaIds[plantilla.codigo] = await upsertPlantilla(client, plantilla);
    }

    const clienteIds = new Map();
    for (const [index, clienteData] of CLIENTS.entries()) {
      const clienteResult = await client.query(
        `INSERT INTO clientes
           (empresa_id, nombre, razon_social, rut, sector, contacto, email, telefono,
            direccion, ciudad, color, activo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE)
         ON CONFLICT (empresa_id, nombre) DO UPDATE SET
           razon_social = EXCLUDED.razon_social,
           rut = EXCLUDED.rut,
           sector = EXCLUDED.sector,
           contacto = EXCLUDED.contacto,
           email = EXCLUDED.email,
           telefono = EXCLUDED.telefono,
           direccion = EXCLUDED.direccion,
           ciudad = EXCLUDED.ciudad,
           color = EXCLUDED.color,
           activo = TRUE,
           actualizado_en = NOW()
         RETURNING id`,
        [
          empresaId,
          clienteData.name,
          clienteData.legalName || clienteData.name,
          clientRut(index),
          clienteData.sector || 'seguridad',
          clienteData.contact || null,
          clienteData.email || null,
          clienteData.phone || null,
          clienteData.address || null,
          clienteData.city || null,
          clienteData.color || '#0f766e',
        ]
      );
      const clienteId = clienteResult.rows[0].id;
      clienteIds.set(clienteData.id, clienteId);

      const operacion = OPERACIONES[clienteData.sector] || OPERACIONES.seguridad;
      const sucursalId = await upsertSucursal(client, {
        empresaId,
        clienteId,
        nombre: clienteData.name,
        direccion: clienteData.address,
        ciudad: clienteData.city,
      });

      for (const puesto of operacion.puestos) {
        await upsertPuesto(client, {
          sucursalId,
          nombre: puesto.nombre,
          plantillaId: plantillaIds[puesto.plantilla],
          minima: puesto.minima,
          coverage: puesto.coverage,
          certifications: operacion.certificaciones,
        });
      }

      for (let guardIndex = 0; guardIndex < 8; guardIndex += 1) {
        const nombre = NOMBRES[(index * 5 + guardIndex) % NOMBRES.length];
        const rut = guardRut(index, guardIndex);
        await upsertGuardia(client, {
          empresaId,
          clienteId,
          nombre,
          rut,
          email: `guardia${index + 1}.${guardIndex + 1}@vigoseguridad.cl`,
          telefono: `+56 9 5555 ${String(index * 10 + guardIndex + 1).padStart(4, '0')}`,
          fechaContrato: '2025-03-01',
          horasSemanales: 42,
          cargo: operacion.cargo,
          certificaciones: operacion.certificaciones,
          numeroCertificado: `OS10-${index + 1}-${guardIndex + 1}`,
          vencimiento: '2027-12-31',
        });
      }
    }

    const usuarios = getDemoAccounts();
    for (const account of usuarios) {
      const clienteId = account.clientId ? clienteIds.get(account.clientId) : null;
      await upsertUsuario(client, {
        empresaId,
        clienteId,
        nombre: account.name,
        email: account.email,
        rol: account.role,
        password: account.password,
      });
    }

    await client.query('COMMIT');

    console.log(`Empresa operadora: ${OPERATOR.name} (${empresaId})`);
    console.log(`Clientes cargados: ${CLIENTS.length}`);
    console.log('Credenciales demo (clave demo1234):');
    console.log(`  operador@vigoseguridad.cl → ${OPERATOR.name}`);
    CLIENTS.forEach((clienteData, index) => {
      console.log(
        `  cliente${index + 1}@vigoseguridad.cl → ${clienteData.name} (${clienteIds.get(clienteData.id)})`
      );
    });
    const first = CLIENTS[0];
    console.log(
      `Prueba de generación: empresa_id=${empresaId}, cliente_id=${clienteIds.get(first.id)}, fecha_inicio=2026-11-30.`
    );
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error cargando datos demo:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
