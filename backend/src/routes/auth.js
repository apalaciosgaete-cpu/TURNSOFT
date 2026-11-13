const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const {
  authenticateToken,
  empresaAccess,
  expireTrialIfNeeded,
} = require('../middleware/auth');
const { hashPassword, verifyPassword } = require('../utils/password');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
      empresa_id: user.empresa_id || null,
      cliente_id: user.cliente_id || null,
      cliente_nombre: user.cliente_nombre || null,
      empresa_nombre: user.empresa_nombre || null,
    },
    process.env.JWT_SECRET || 'secret_dev',
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    rol: user.rol,
    empresa_id: user.empresa_id || null,
    cliente_id: user.cliente_id || null,
    cliente_nombre: user.cliente_nombre || null,
    empresa_nombre: user.empresa_nombre || null,
    empresa_estado: user.empresa_estado || null,
    prueba_fin: user.prueba_fin || null,
    plan_nombre: user.plan_nombre || null,
  };
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function clean(value, max = 200) {
  return String(value || '').trim().slice(0, max);
}

async function userCount(client = pool) {
  const result = await client.query('SELECT count(*)::int AS total FROM usuarios');
  return result.rows[0]?.total || 0;
}

/**
 * Estado público del arranque. Si todavía no existe ningún usuario, el frontend
 * muestra la pantalla de configuración inicial en lugar del login.
 */
router.get('/bootstrap', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const total = await userCount();
    res.json({
      app: 'TURNSOFT',
      needsSetup: total === 0,
      userCount: total,
    });
  } catch (error) {
    // Sin esquema o sin base, el frontend debe poder mostrar el login normal.
    if (error.code === '42P01') {
      return res.json({ app: 'TURNSOFT', needsSetup: true, userCount: 0, schemaReady: false });
    }
    console.error('[auth/bootstrap]', error);
    res.status(503).json({ error: 'No se pudo verificar el estado de la instalación.' });
  }
});

/**
 * Configuración inicial: crea la cuenta de supervisor maestro de la aplicación.
 * Es global, no pertenece a una empresa. Las empresas se registran desde la
 * página pública y este rol solo supervisa ocupación, pagos, planes y soporte.
 */
router.post('/setup', async (req, res) => {
  const adminBody = req.body?.admin || req.body || {};
  const nombre = clean(adminBody.nombre, 200);
  const email = clean(adminBody.email, 200).toLowerCase();
  const password = String(adminBody.password || '');

  if (!nombre) return res.status(400).json({ error: 'Ingresa el nombre del supervisor maestro.' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Ingresa un correo válido.' });
  if (password.length < 8) {
    return res.status(400).json({ error: 'La clave debe tener al menos 8 caracteres.' });
  }
  if (password.length > 128) {
    return res.status(400).json({ error: 'La clave no puede superar los 128 caracteres.' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    // Serializa dos intentos simultáneos de configuración inicial.
    await client.query('LOCK TABLE usuarios IN EXCLUSIVE MODE');

    if ((await userCount(client)) > 0) {
      throw httpError(409, 'La configuración inicial ya fue completada. Inicia sesión con tu cuenta.');
    }

    const userResult = await client.query(
      `INSERT INTO usuarios (empresa_id, cliente_id, nombre, email, password_hash, rol, activo)
       VALUES (NULL, NULL, $1, $2, $3, 'superadmin', true)
       RETURNING *`,
      [nombre, email, hashPassword(password)]
    );
    const user = userResult.rows[0];

    await client.query('COMMIT');

    const fullUser = {
      ...user,
      empresa_nombre: 'TURNSOFT',
      cliente_nombre: null,
    };
    return res.status(201).json({
      token: signToken(fullUser),
      user: publicUser(fullUser),
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    if (error.status) return res.status(error.status).json({ error: error.message });
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
    }
    if (error.code === '42P01') {
      return res.status(503).json({ error: 'El esquema de la base de datos aún no está migrado.' });
    }
    console.error('[auth/setup]', error);
    return res.status(500).json({ error: 'No se pudo completar la configuración inicial.' });
  } finally {
    client?.release();
  }
});

// Login contra la tabla `usuarios`.
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'El correo es requerido.' });
  }

  try {
    const result = await pool.query(
      `SELECT u.*, c.nombre AS cliente_nombre, e.razon_social AS empresa_nombre,
              e.estado AS empresa_estado, e.prueba_fin,
              p.nombre AS plan_nombre
       FROM usuarios u
       LEFT JOIN clientes c ON c.id = u.cliente_id
       LEFT JOIN empresas e ON e.id = u.empresa_id
       LEFT JOIN planes p ON p.id = e.plan_id
       WHERE lower(u.email) = lower($1) AND u.activo = true
       LIMIT 1`,
      [email]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Correo o clave incorrectos.' });
    }

    let user = result.rows[0];
    if (!verifyPassword(password || '', user.password_hash)) {
      return res.status(401).json({ error: 'Correo o clave incorrectos.' });
    }

    if (user.rol !== 'superadmin' && user.empresa_id) {
      const empresa = await expireTrialIfNeeded({
        id: user.empresa_id,
        estado: user.empresa_estado,
        prueba_fin: user.prueba_fin,
      });
      const access = empresaAccess(empresa);
      if (!access.allowed) {
        return res.status(403).json({ error: access.error, code: access.code });
      }
    }

    return res.json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    if (error.code === '42P01') {
      return res.status(503).json({
        error: 'La instalación aún no está configurada. Recarga la página para iniciar el setup.',
      });
    }
    console.error('[auth/login]', error);
    return res.status(503).json({
      error: 'Base de datos no disponible. No es posible verificar la cuenta.',
    });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.nombre, u.rol, u.empresa_id, u.cliente_id,
              c.nombre AS cliente_nombre, e.razon_social AS empresa_nombre,
              e.estado AS empresa_estado, e.prueba_fin,
              p.nombre AS plan_nombre
       FROM usuarios u
       LEFT JOIN clientes c ON c.id = u.cliente_id
       LEFT JOIN empresas e ON e.id = u.empresa_id
       LEFT JOIN planes p ON p.id = e.plan_id
       WHERE u.id = $1 AND u.activo = true
       LIMIT 1`,
      [req.user.id]
    );
    if (!result.rows.length) {
      return res.status(401).json({ error: 'La cuenta ya no está disponible.' });
    }
    return res.json({ user: publicUser(result.rows[0]) });
  } catch (error) {
    console.error('[auth/me]', error);
    return res.status(503).json({ error: 'No se pudo verificar la sesión.' });
  }
});

module.exports = router;
