const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// Listar guardias de una empresa
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { empresa_id } = req.query;
    let query = `SELECT g.*, 
                        c.numero_certificado, c.fecha_vencimiento, c.emitido_por
                 FROM guardias g
                 LEFT JOIN certificaciones_os10 c ON c.guardia_id = g.id`;
    const params = [];

    if (empresa_id) {
      query += ` WHERE g.empresa_id = $${params.length + 1}`;
      params.push(empresa_id);
    }

    query += ` ORDER BY g.nombre_completo`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear guardia
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { empresa_id, nombre_completo, rut, email, telefono, fecha_contrato, horas_semanales_max } = req.body;

    const result = await pool.query(
      `INSERT INTO guardias (empresa_id, nombre_completo, rut, email, telefono, fecha_contrato, horas_semanales_max)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [empresa_id, nombre_completo, rut, email, telefono, fecha_contrato, horas_semanales_max]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Registrar certificación OS-10
router.post('/:id/certificacion-os10', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { numero_certificado, fecha_vencimiento } = req.body;

    // Eliminar certificación anterior si existe
    await pool.query('DELETE FROM certificaciones_os10 WHERE guardia_id = $1', [id]);

    const result = await pool.query(
      `INSERT INTO certificaciones_os10 (guardia_id, numero_certificado, fecha_vencimiento)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [id, numero_certificado, fecha_vencimiento]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar guardia
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre_completo, rut, email, telefono, fecha_contrato, horas_semanales_max, activo } = req.body;

    const result = await pool.query(
      `UPDATE guardias 
       SET nombre_completo = $1, rut = $2, email = $3, telefono = $4, fecha_contrato = $5, horas_semanales_max = $6, activo = $7, actualizado_en = NOW()
       WHERE id = $8
       RETURNING *`,
      [nombre_completo, rut, email, telefono, fecha_contrato, horas_semanales_max, activo, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Guardia no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;