const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { verifyPassword } = require('../utils/password');

const DB_UNAVAILABLE_CODES = new Set([
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EHOSTUNREACH',
  '28P01',
  '3D000',
  '42P01',
]);

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
  };
}

// Login. Con PostgreSQL valida la tabla `usuarios`; sin base de datos deja
// pasar un operador demo para no bloquear el desarrollo local.
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'El correo es requerido.' });
  }

  try {
    const result = await pool.query(
      `SELECT u.*, c.nombre AS cliente_nombre, e.razon_social AS empresa_nombre
       FROM usuarios u
       LEFT JOIN clientes c ON c.id = u.cliente_id
       LEFT JOIN empresas e ON e.id = u.empresa_id
       WHERE lower(u.email) = lower($1) AND u.activo = true
       LIMIT 1`,
      [email]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Correo o clave incorrectos.' });
    }

    const user = result.rows[0];
    if (!verifyPassword(password || '', user.password_hash)) {
      return res.status(401).json({ error: 'Correo o clave incorrectos.' });
    }

    return res.json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    if (!DB_UNAVAILABLE_CODES.has(error.code)) {
      console.error('[auth/login]', error);
      return res.status(500).json({ error: error.message });
    }

    // Sin base de datos no es posible verificar cuentas ni su alcance. El modo
    // demo debe habilitarse explícitamente para no convertir una caída de la
    // base en un acceso de operador global.
    if (process.env.ALLOW_DEMO_AUTH !== 'true') {
      return res.status(503).json({
        error: 'Base de datos no disponible. No es posible verificar la cuenta.',
      });
    }

    const demo = {
      id: '00000000-0000-0000-0000-000000000001',
      email: email || 'operador@vigoseguridad.cl',
      nombre: 'Operador demo',
      rol: 'operador',
      empresa_id: null,
      cliente_id: null,
    };
    return res.json({ token: signToken(demo), user: publicUser(demo), demo: true });
  }
});

router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
