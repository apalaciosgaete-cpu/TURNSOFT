const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateAllowingPending, clearUsuarioCache } = require('../middleware/auth');
const { canManageUsers, httpError } = require('../middleware/tenant');
const { TRATAMIENTO_DATOS_VERSION } = require('../config/datos');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value, max) {
  return String(value || '').trim().slice(0, max);
}

function fail(res, error, label) {
  if (error.status) return res.status(error.status).json({ error: error.message });
  console.error(`[datos/${label}]`, error);
  return res.status(500).json({ error: 'Error interno del servidor' });
}

function assertEmpresa(user) {
  if (!user.empresa_id || !['operador', 'admin', 'validador'].includes(user.rol)) {
    throw httpError(403, 'Este apartado es solo para cuentas de una empresa.');
  }
}

// Estado de la aceptación vigente de la empresa.
router.get('/tratamiento', authenticateAllowingPending, async (req, res) => {
  try {
    assertEmpresa(req.user);
    const result = await pool.query(
      `SELECT nombre_firmante, cargo, email_privacidad, aceptado_en
       FROM aceptaciones_datos
       WHERE empresa_id = $1 AND version = $2
       ORDER BY aceptado_en DESC LIMIT 1`,
      [req.user.empresa_id, TRATAMIENTO_DATOS_VERSION]
    );
    res.json({
      version: TRATAMIENTO_DATOS_VERSION,
      aceptado: result.rows.length > 0,
      aceptacion: result.rows[0] || null,
      puede_aceptar: canManageUsers(req.user),
    });
  } catch (error) {
    fail(res, error, 'estado');
  }
});

// La empresa (responsable) acepta el encargo de tratamiento de datos a TURNSOFT.
router.post('/tratamiento/aceptar', authenticateAllowingPending, async (req, res) => {
  try {
    assertEmpresa(req.user);
    if (!canManageUsers(req.user)) {
      throw httpError(403, 'Solo el acceso de la empresa o un administrador puede aceptar.');
    }
    const body = req.body || {};
    const nombre = clean(body.nombre, 200);
    const cargo = clean(body.cargo, 120);
    const emailPrivacidad = clean(body.email_privacidad, 200).toLowerCase();

    if (body.version !== TRATAMIENTO_DATOS_VERSION) {
      throw httpError(409, 'El texto cambió. Recarga la página para leer la versión vigente.');
    }
    if (body.acepta !== true || body.declara_base_legal !== true) {
      throw httpError(400, 'Debes aceptar ambas declaraciones para continuar.');
    }
    if (nombre.length < 3) throw httpError(400, 'Ingresa el nombre de quien acepta por la empresa.');
    if (cargo.length < 2) throw httpError(400, 'Ingresa el cargo de quien acepta.');
    if (!EMAIL_RE.test(emailPrivacidad)) {
      throw httpError(400, 'Ingresa un correo válido para consultas de privacidad.');
    }

    await pool.query(
      `INSERT INTO aceptaciones_datos
         (empresa_id, usuario_id, version, nombre_firmante, cargo, email_privacidad, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        req.user.empresa_id,
        req.user.id,
        TRATAMIENTO_DATOS_VERSION,
        nombre,
        cargo,
        emailPrivacidad,
        clean(req.headers['x-forwarded-for'] || req.ip, 160) || null,
        clean(req.headers['user-agent'], 300) || null,
      ]
    );
    clearUsuarioCache(); // todos los usuarios de la empresa quedan habilitados de inmediato
    res.status(201).json({ ok: true, version: TRATAMIENTO_DATOS_VERSION });
  } catch (error) {
    fail(res, error, 'aceptar');
  }
});

module.exports = router;
