const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { isSuperadmin } = require('../middleware/tenant');

const CATEGORIAS = new Set(['consulta', 'pago', 'tecnico', 'otro']);
const PRIORIDADES = new Set(['baja', 'normal', 'alta', 'urgente']);

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function clean(value, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

function handleError(res, error, context) {
  if (error.status) return res.status(error.status).json({ error: error.message });
  if (error.code === '22P02') return res.status(400).json({ error: 'Identificador inválido.' });
  if (error.code === '42P01') {
    return res.status(503).json({ error: 'El módulo de soporte aún no está migrado.' });
  }
  console.error(`[soporte/${context}]`, error);
  return res.status(500).json({ error: 'No se pudo completar la operación de soporte.' });
}

router.use(authenticateToken);

// Bandeja de soporte del usuario: cliente ve sus tickets; operador ve los de su empresa.
router.get('/', async (req, res) => {
  try {
    let where = '';
    const values = [];
    if (isSuperadmin(req.user)) {
      where = '';
    } else if (req.user.rol === 'cliente' && req.user.cliente_id) {
      values.push(req.user.id);
      where = 'WHERE t.usuario_id = $1';
    } else if (req.user.empresa_id) {
      values.push(req.user.empresa_id);
      where = 'WHERE t.empresa_id = $1';
    } else {
      return res.json([]);
    }

    const result = await pool.query(
      `SELECT t.*, e.razon_social,
              u.nombre AS usuario_nombre, u.email AS usuario_email
       FROM soporte_tickets t
       JOIN empresas e ON e.id = t.empresa_id
       LEFT JOIN usuarios u ON u.id = t.usuario_id
       ${where}
       ORDER BY t.creado_en DESC`,
      values
    );
    res.json(result.rows);
  } catch (error) {
    handleError(res, error, 'list');
  }
});

// Crear ticket.
router.post('/', async (req, res) => {
  try {
    if (!req.user.empresa_id) {
      return res.status(400).json({ error: 'Tu cuenta no pertenece a una empresa operadora.' });
    }

    const asunto = clean(req.body?.asunto, 200);
    const mensaje = clean(req.body?.mensaje, 5000);
    const categoria = clean(req.body?.categoria, 20) || 'consulta';
    const prioridad = clean(req.body?.prioridad, 20) || 'normal';

    if (!asunto) return res.status(400).json({ error: 'Ingresa un asunto para el ticket.' });
    if (!mensaje) return res.status(400).json({ error: 'Describe el problema o la consulta.' });
    if (!CATEGORIAS.has(categoria)) return res.status(400).json({ error: 'La categoría no es válida.' });
    if (!PRIORIDADES.has(prioridad)) return res.status(400).json({ error: 'La prioridad no es válida.' });

    const result = await pool.query(
      `INSERT INTO soporte_tickets
         (empresa_id, usuario_id, asunto, mensaje, categoria, prioridad)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.empresa_id, req.user.id, asunto, mensaje, categoria, prioridad]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    handleError(res, error, 'create');
  }
});

// Marcar la respuesta como vista.
router.patch('/:id/visto', async (req, res) => {
  try {
    const values = [req.params.id];
    let scope = '';
    if (!isSuperadmin(req.user)) {
      if (req.user.rol === 'cliente') {
        values.push(req.user.id);
        scope = 'AND usuario_id = $2';
      } else if (req.user.empresa_id) {
        values.push(req.user.empresa_id);
        scope = 'AND empresa_id = $2';
      } else {
        throw httpError(403, 'No tienes acceso a este ticket.');
      }
    }

    const result = await pool.query(
      `UPDATE soporte_tickets
       SET visto_cliente = true, actualizado_en = NOW()
       WHERE id = $1 ${scope}
       RETURNING *`,
      values
    );
    if (!result.rows.length) throw httpError(404, 'Ticket no encontrado.');
    res.json(result.rows[0]);
  } catch (error) {
    handleError(res, error, 'visto');
  }
});

module.exports = router;
