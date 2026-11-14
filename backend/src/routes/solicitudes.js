const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const {
  scopedClienteId,
  scopedEmpresaId,
  assertClienteAccess,
  httpError,
} = require('../middleware/tenant');

// Listar solicitudes visibles para la cuenta.
router.get('/', authenticateToken, async (req, res) => {
  try {
    const empresaId = scopedEmpresaId(req.user, req.query.empresa_id);
    const clienteId = scopedClienteId(req.user, req.query.cliente_id);
    const result = await pool.query(
      `SELECT s.*, g.nombre_completo AS guardia_nombre,
              g.empresa_id, COALESCE(s.cliente_id, g.cliente_id) AS cliente_id,
              c.nombre AS cliente_nombre
       FROM solicitudes s
       JOIN guardias g ON g.id = s.guardia_id
       LEFT JOIN clientes c ON c.id = COALESCE(s.cliente_id, g.cliente_id)
       WHERE ($1::uuid IS NULL OR g.empresa_id = $1)
         AND ($2::uuid IS NULL OR COALESCE(s.cliente_id, g.cliente_id) = $2)
         AND ($3::uuid IS NULL OR s.guardia_id = $3)
       ORDER BY s.creado_en DESC`,
      [empresaId || null, clienteId || null, req.query.guardia_id || null]
    );
    res.json(result.rows);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear solicitud. La guardia debe pertenecer a la empresa/cliente del token.
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { guardia_id, fecha_inicio, fecha_fin, tipo, motivo } = req.body;
    if (!guardia_id || !fecha_inicio || !fecha_fin || !tipo) {
      return res
        .status(400)
        .json({ error: 'guardia_id, fecha_inicio, fecha_fin y tipo son requeridos.' });
    }

    const empresaId = scopedEmpresaId(req.user, req.body.empresa_id);
    const guardResult = await pool.query(
      `SELECT id, empresa_id, cliente_id FROM guardias
       WHERE id = $1 AND ($2::uuid IS NULL OR empresa_id = $2)`,
      [guardia_id, empresaId || null]
    );
    if (!guardResult.rows.length) {
      return res.status(404).json({ error: 'Guardia no encontrado para esta cuenta.' });
    }

    const guard = guardResult.rows[0];
    if (req.user?.cliente_id && String(guard.cliente_id) !== String(req.user.cliente_id)) {
      throw httpError(403, 'No tienes acceso a los datos de otro cliente.');
    }
    assertClienteAccess(req.user, guard.cliente_id);
    const clienteId = scopedClienteId(req.user, req.body.cliente_id || guard.cliente_id);

    const result = await pool.query(
      `INSERT INTO solicitudes (guardia_id, cliente_id, fecha_inicio, fecha_fin, tipo, motivo)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [guardia_id, clienteId || null, fecha_inicio, fecha_fin, tipo, motivo || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar estado de solicitud.
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { estado } = req.body;
    const empresaId = scopedEmpresaId(req.user, req.body.empresa_id);
    const clienteId = scopedClienteId(req.user, req.body.cliente_id);

    const result = await pool.query(
      `UPDATE solicitudes s
       SET estado = $1
       FROM guardias g
       WHERE g.id = s.guardia_id
         AND s.id = $2
         AND ($3::uuid IS NULL OR g.empresa_id = $3)
         AND ($4::uuid IS NULL OR COALESCE(s.cliente_id, g.cliente_id) = $4)
       RETURNING s.*`,
      [estado, req.params.id, empresaId || null, clienteId || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
