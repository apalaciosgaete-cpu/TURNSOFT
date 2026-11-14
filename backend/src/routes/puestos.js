const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { scopedClienteId, scopedEmpresaId } = require('../middleware/tenant');

// Listar puestos de una sucursal, filtrados por empresa y cliente.
router.get('/', authenticateToken, async (req, res) => {
  try {
    const clienteId = scopedClienteId(req.user, req.query.cliente_id);
    const empresaId = scopedEmpresaId(req.user, req.query.empresa_id);
    const result = await pool.query(
      `SELECT p.*, s.nombre AS sucursal_nombre, s.cliente_id,
              c.nombre AS cliente_nombre
       FROM puestos p
       JOIN sucursales s ON s.id = p.sucursal_id
       LEFT JOIN clientes c ON c.id = s.cliente_id
       WHERE ($1::uuid IS NULL OR p.sucursal_id = $1)
         AND ($2::uuid IS NULL OR s.cliente_id = $2)
         AND ($3::uuid IS NULL OR s.empresa_id = $3)
       ORDER BY p.nombre`,
      [req.query.sucursal_id || null, clienteId, empresaId]
    );
    res.json(result.rows);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear puesto dentro de una sucursal permitida.
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      sucursal_id,
      nombre,
      minima_cobertura = 1,
      turno_plantilla_id = null,
      cobertura_semanal = null,
      certificaciones_requeridas = [],
    } = req.body;

    if (!sucursal_id || !nombre) {
      return res.status(400).json({ error: 'sucursal_id y nombre son requeridos.' });
    }

    const clienteId = scopedClienteId(req.user, req.body.cliente_id);
    const empresaId = scopedEmpresaId(req.user, req.body.empresa_id);
    const sucursal = await pool.query(
      `SELECT id FROM sucursales
       WHERE id = $1
         AND ($2::uuid IS NULL OR empresa_id = $2)
         AND ($3::uuid IS NULL OR cliente_id = $3)`,
      [sucursal_id, empresaId, clienteId]
    );
    if (!sucursal.rows.length) {
      return res.status(404).json({ error: 'Sucursal no encontrada para esta cuenta.' });
    }

    const result = await pool.query(
      `INSERT INTO puestos
         (sucursal_id, nombre, minima_cobertura, turno_plantilla_id, cobertura_semanal, certificaciones_requeridas)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [sucursal_id, nombre, minima_cobertura, turno_plantilla_id, cobertura_semanal, certificaciones_requeridas]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
