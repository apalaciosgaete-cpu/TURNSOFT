const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { hashPassword } = require('../utils/password');
const { getJwtSecret, JWT_ALGORITHM } = require('../config/jwt');
const rateLimits = require('../middleware/rateLimit');

const SECTORES = new Set(['seguridad', 'salud', 'mineria', 'retail', 'logistica']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RUT_RE = /^\d{6,8}-[0-9kK]$/;
const PRUEBA_DIAS = 15;

function clean(value, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeRut(value) {
  return clean(value, 20).replace(/\./g, '').replace(/\s/g, '').toUpperCase();
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function handleError(res, error, context) {
  if (error.status) return res.status(error.status).json({ error: error.message });
  if (error.code === '23505') {
    if (error.constraint === 'empresas_rut_empresa_key') {
      return res.status(409).json({ error: 'Ya existe una empresa registrada con ese RUT.' });
    }
    if (error.constraint === 'usuarios_email_key') {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
    }
    return res.status(409).json({ error: 'Ya existe un registro con esos datos.' });
  }
  if (error.code === '42P01') {
    return res.status(503).json({ error: 'El esquema de la base de datos aún no está migrado.' });
  }
  console.error(`[public/${context}]`, error);
  return res.status(500).json({ error: 'No se pudo completar la operación.' });
}

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
      empresa_id: user.empresa_id || null,
      cliente_id: null,
      cliente_nombre: null,
      empresa_nombre: user.empresa_nombre || null,
    },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h', algorithm: JWT_ALGORITHM }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    rol: user.rol,
    empresa_id: user.empresa_id || null,
    cliente_id: null,
    cliente_nombre: null,
    empresa_nombre: user.empresa_nombre || null,
    empresa_estado: user.empresa_estado || null,
    prueba_fin: user.prueba_fin || null,
    plan_nombre: user.plan_nombre || null,
  };
}

/**
 * Catálogo público: solo planes activos y datos comerciales, sin información
 * interna de empresas ni del supervisor.
 */
router.get('/planes', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const result = await pool.query(
      `SELECT id, nombre, descripcion, precio_mensual, moneda,
              max_clientes, max_usuarios, max_guardias
       FROM planes
       WHERE activo = true
       ORDER BY precio_mensual, nombre`
    );
    res.json(result.rows);
  } catch (error) {
    handleError(res, error, 'planes');
  }
});

/**
 * Registro público de una empresa. Crea la empresa en estado de prueba de
 * 15 días, su cuenta administradora, su configuración legal y la primera
 * mensualidad pendiente para que el supervisor la verifique al recibir el pago.
 */
router.post('/registro', rateLimits.registro, async (req, res) => {
  const empresaBody = req.body?.empresa || req.body || {};
  const adminBody = req.body?.admin || req.body || {};

  const razonSocial = clean(empresaBody.razon_social, 200);
  const rutEmpresa = normalizeRut(empresaBody.rut_empresa);
  const sector = clean(empresaBody.sector, 20).toLowerCase() || 'seguridad';
  const emailContacto = clean(empresaBody.email_contacto, 200).toLowerCase();
  const telefono = clean(empresaBody.telefono, 50) || null;
  const direccion = clean(empresaBody.direccion, 500) || null;
  const ciudad = clean(empresaBody.ciudad, 100) || null;
  const planId = clean(empresaBody.plan_id, 36);

  const adminNombre = clean(adminBody.nombre, 200);
  const adminEmail = clean(adminBody.email, 200).toLowerCase();
  const adminPassword = String(adminBody.password || '');

  if (razonSocial.length < 2) {
    return res.status(400).json({ error: 'Ingresa la razón social de la empresa.' });
  }
  if (!RUT_RE.test(rutEmpresa)) {
    return res.status(400).json({ error: 'Ingresa un RUT válido, por ejemplo 76.123.456-7.' });
  }
  if (!SECTORES.has(sector)) {
    return res.status(400).json({ error: 'Selecciona un sector válido.' });
  }
  if (emailContacto && !EMAIL_RE.test(emailContacto)) {
    return res.status(400).json({ error: 'Ingresa un correo de contacto válido.' });
  }
  if (!planId) {
    return res.status(400).json({ error: 'Selecciona el plan con el que quieres comenzar.' });
  }
  if (!adminNombre) {
    return res.status(400).json({ error: 'Ingresa el nombre del administrador.' });
  }
  if (!EMAIL_RE.test(adminEmail)) {
    return res.status(400).json({ error: 'Ingresa un correo válido para el administrador.' });
  }
  if (adminPassword.length < 8) {
    return res.status(400).json({ error: 'La clave debe tener al menos 8 caracteres.' });
  }
  if (adminPassword.length > 128) {
    return res.status(400).json({ error: 'La clave no puede superar los 128 caracteres.' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const planResult = await client.query(
      'SELECT * FROM planes WHERE id = $1 AND activo = true',
      [planId]
    );
    if (!planResult.rows.length) {
      throw httpError(400, 'El plan seleccionado ya no está disponible. Elige otro plan.');
    }
    const plan = planResult.rows[0];

    const empresaResult = await client.query(
      `INSERT INTO empresas
         (razon_social, rut_empresa, sector, plan_id, estado, dia_cobro,
          email_contacto, telefono, direccion, ciudad,
          prueba_inicio, prueba_fin, origen)
       VALUES
         ($1, $2, $3, $4, 'prueba',
          LEAST(EXTRACT(DAY FROM (NOW() + ($5 || ' days')::interval))::int, 28),
          $6, $7, $8, $9, NOW(), NOW() + ($5 || ' days')::interval, 'registro')
       RETURNING id, razon_social, rut_empresa, sector, estado, plan_id, dia_cobro,
                 email_contacto, telefono, direccion, ciudad,
                 prueba_inicio, prueba_fin, creado_en`,
      [razonSocial, rutEmpresa, sector, planId, String(PRUEBA_DIAS), emailContacto || null, telefono, direccion, ciudad]
    );
    const empresa = empresaResult.rows[0];

    await client.query(
      `INSERT INTO configuracion_legal
         (empresa_id, jornada_maxima_semanal, descanso_minimo_entre_turnos,
          horas_extras_max_diarias, recargo_dominical_festivo)
       VALUES ($1, 42, 12, 2, 30)`,
      [empresa.id]
    );

    const adminResult = await client.query(
      `INSERT INTO usuarios (empresa_id, cliente_id, nombre, email, password_hash, rol, activo)
       VALUES ($1, NULL, $2, $3, $4, 'operador', true)
       RETURNING id, nombre, email, rol, empresa_id, creado_en`,
      [empresa.id, adminNombre, adminEmail, hashPassword(adminPassword)]
    );

    // Primera mensualidad pendiente: el supervisor la verifica cuando el pago
    // se confirma y, en ese mismo paso, la empresa pasa a activa.
    const pagoResult = await client.query(
      `INSERT INTO pagos
         (empresa_id, plan_id, periodo, monto, estado, fecha_vencimiento, notas)
       VALUES ($1, $2, to_char(NOW() + ($4 || ' days')::interval, 'YYYY-MM'),
               $3, 'pendiente', (NOW() + ($4 || ' days')::interval)::date,
               'Primer mes contratado al finalizar la prueba de 15 días.')
       RETURNING id, periodo, monto, estado, fecha_vencimiento`,
      [empresa.id, planId, plan.precio_mensual, String(PRUEBA_DIAS)]
    );

    await client.query('COMMIT');

    const user = {
      ...adminResult.rows[0],
      empresa_nombre: empresa.razon_social,
      empresa_estado: empresa.estado,
      prueba_fin: empresa.prueba_fin,
      plan_nombre: plan.nombre,
    };

    return res.status(201).json({
      token: signToken(user),
      user: publicUser(user),
      empresa,
      plan: {
        id: plan.id,
        nombre: plan.nombre,
        precio_mensual: plan.precio_mensual,
      },
      pago: pagoResult.rows[0],
      prueba: {
        dias: PRUEBA_DIAS,
        inicia: empresa.prueba_inicio,
        termina: empresa.prueba_fin,
      },
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    handleError(res, error, 'registro');
  } finally {
    client?.release();
  }
});

module.exports = router;
