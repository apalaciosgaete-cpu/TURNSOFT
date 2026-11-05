const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// Listar solicitudes
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { empresa_id, guardia_id } = req.query;
    let query = `SELECT s.*, g.nombre_completo as guardia_nombre
                 FROM solicitudes s
                 JOIN guardias g ON g.id = s.guardia_id`;
    const params = [];

    const conditions = [];
    if (empresa_id) {
      conditions.push(`g.empresa_id = $${params.length + 1}`);
      params.push(empresa_id);
    }
    if (guardia_id) {
      conditions.push(`s.guardia_id = $${params.length + 1}`);
      params.push(guardia_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY s.creado_en DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear solicitud
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { guardia_id, fecha_inicio, fecha_fin, tipo, motivo } = req.body;

    const result = await pool.query(
      `INSERT INTO solicitudes (guardia_id, fecha_inicio, fecha_fin, tipo, motivo)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [guardia_id, fecha_inicio, fecha_fin, tipo, motivo]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar estado de solicitud
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const result = await pool.query(
      `UPDATE solicitudes SET estado = $1 WHERE id = $2 RETURNING *`,
      [estado, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;