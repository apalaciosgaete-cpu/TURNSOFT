const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken, clearUsuarioCache } = require('../middleware/auth');
const { requireUserManager, httpError } = require('../middleware/tenant');
const { hashPassword, generateTempPassword } = require('../utils/password');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// El titular (operador) solo se crea al registrar la empresa.
const ROLES_ASIGNABLES = new Set(['admin', 'validador']);

function clean(value, max = 200) {
  return String(value || '').trim().slice(0, max);
}

function fail(res, error, label) {
  if (error.status) return res.status(error.status).json({ error: error.message });
  if (error.code === '23505') {
    return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
  }
  console.error(`[usuarios/${label}]`, error);
  return res.status(500).json({ error: 'Error interno del servidor' });
}

/** Usuario interno de la misma empresa que quien consulta. */
async function findInternal(id, empresaId) {
  const result = await pool.query(
    `SELECT * FROM usuarios
     WHERE id = $1 AND empresa_id = $2 AND rol IN ('operador', 'admin', 'validador')`,
    [id, empresaId]
  );
  return result.rows[0] || null;
}

/**
 * Un administrador no puede modificar al titular; solo el titular lo hace sobre
 * sí mismo (nombre) y nadie lo desactiva desde aquí.
 */
function assertCanEdit(actor, target) {
  if (target.rol === 'operador' && actor.rol !== 'operador') {
    throw httpError(403, 'Solo el acceso de la empresa puede modificar su propia cuenta.');
  }
}

// Lista los usuarios internos de la empresa.
router.get('/', authenticateToken, requireUserManager, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nombre, email, rol, activo, debe_cambiar_clave, creado_en
       FROM usuarios
       WHERE empresa_id = $1 AND rol IN ('operador', 'admin', 'validador')
       ORDER BY (rol = 'operador') DESC, activo DESC, nombre`,
      [req.user.empresa_id]
    );
    const limite = await pool.query(
      `SELECT p.max_usuarios FROM empresas e LEFT JOIN planes p ON p.id = e.plan_id WHERE e.id = $1`,
      [req.user.empresa_id]
    );
    res.json({
      usuarios: result.rows,
      max_usuarios: limite.rows[0]?.max_usuarios ?? null,
    });
  } catch (error) {
    fail(res, error, 'listar');
  }
});

// Crea un administrador o validador con clave temporal.
router.post('/', authenticateToken, requireUserManager, async (req, res) => {
  try {
    const nombre = clean(req.body?.nombre);
    const email = clean(req.body?.email).toLowerCase();
    const rol = clean(req.body?.rol, 20);
    if (!nombre) throw httpError(400, 'Ingresa el nombre de la persona.');
    if (!EMAIL_RE.test(email)) throw httpError(400, 'Ingresa un correo válido.');
    if (!ROLES_ASIGNABLES.has(rol)) throw httpError(400, 'Elige el rol: administrador o validador.');

    const limite = await pool.query(
      `SELECT p.max_usuarios,
              (SELECT count(*)::int FROM usuarios
               WHERE empresa_id = e.id AND activo AND rol IN ('operador', 'admin', 'validador')) AS activos
       FROM empresas e LEFT JOIN planes p ON p.id = e.plan_id WHERE e.id = $1`,
      [req.user.empresa_id]
    );
    const max = limite.rows[0]?.max_usuarios;
    if (max !== null && max !== undefined && limite.rows[0].activos >= max) {
      throw httpError(409, `Tu plan permite hasta ${max} usuarios de gestión.`);
    }

    const temporal = generateTempPassword();
    const result = await pool.query(
      `INSERT INTO usuarios
         (empresa_id, cliente_id, nombre, email, password_hash, rol, activo, debe_cambiar_clave, creado_por)
       VALUES ($1, NULL, $2, $3, $4, $5, true, true, $6)
       RETURNING id, nombre, email, rol, activo, debe_cambiar_clave, creado_en`,
      [req.user.empresa_id, nombre, email, hashPassword(temporal), rol, req.user.id]
    );
    res.status(201).json({ usuario: result.rows[0], clave_temporal: temporal });
  } catch (error) {
    fail(res, error, 'crear');
  }
});

// Cambia nombre, rol o estado (activo) de un usuario interno.
router.patch('/:id', authenticateToken, requireUserManager, async (req, res) => {
  try {
    const target = await findInternal(req.params.id, req.user.empresa_id);
    if (!target) throw httpError(404, 'Usuario no encontrado.');
    assertCanEdit(req.user, target);

    const body = req.body || {};
    const next = { nombre: target.nombre, rol: target.rol, activo: target.activo };

    if (body.nombre !== undefined) {
      next.nombre = clean(body.nombre);
      if (!next.nombre) throw httpError(400, 'Ingresa el nombre de la persona.');
    }
    if (body.rol !== undefined && body.rol !== target.rol) {
      if (target.rol === 'operador') throw httpError(400, 'No se puede cambiar el rol del acceso de la empresa.');
      if (!ROLES_ASIGNABLES.has(body.rol)) throw httpError(400, 'Elige el rol: administrador o validador.');
      next.rol = body.rol;
    }
    if (body.activo !== undefined && Boolean(body.activo) !== target.activo) {
      if (String(target.id) === String(req.user.id)) {
        throw httpError(400, 'No puedes desactivar tu propia cuenta.');
      }
      if (target.rol === 'operador') throw httpError(400, 'El acceso de la empresa no se puede desactivar.');
      next.activo = Boolean(body.activo);
    }

    const result = await pool.query(
      `UPDATE usuarios SET nombre = $1, rol = $2, activo = $3, actualizado_en = NOW()
       WHERE id = $4 AND empresa_id = $5
       RETURNING id, nombre, email, rol, activo, debe_cambiar_clave, creado_en`,
      [next.nombre, next.rol, next.activo, target.id, req.user.empresa_id]
    );
    clearUsuarioCache(target.id);
    res.json({ usuario: result.rows[0] });
  } catch (error) {
    fail(res, error, 'editar');
  }
});

// Restablece la clave con una temporal que debe cambiarse al entrar.
router.post('/:id/restablecer-clave', authenticateToken, requireUserManager, async (req, res) => {
  try {
    const target = await findInternal(req.params.id, req.user.empresa_id);
    if (!target) throw httpError(404, 'Usuario no encontrado.');
    assertCanEdit(req.user, target);
    if (String(target.id) === String(req.user.id)) {
      throw httpError(400, 'Cambia tu propia clave desde tu cuenta.');
    }
    const temporal = generateTempPassword();
    await pool.query(
      `UPDATE usuarios SET password_hash = $1, debe_cambiar_clave = true, actualizado_en = NOW()
       WHERE id = $2 AND empresa_id = $3`,
      [hashPassword(temporal), target.id, req.user.empresa_id]
    );
    res.json({ clave_temporal: temporal });
  } catch (error) {
    fail(res, error, 'restablecer');
  }
});

module.exports = router;
