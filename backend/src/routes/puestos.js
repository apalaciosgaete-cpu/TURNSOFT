const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// Listar puestos de una sucursal
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { sucursal_id } = req.query;
    let query = 'SELECT * FROM puestos';
    const params = [];

    if (sucursal_id) {
      query += ' WHERE sucursal_id = $1';
      params.push(sucursal_id);
    }

    query += ' ORDER BY nombre';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear puesto
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { sucursal_id, nombre, minima_cobertura = 1 } = req.body;

    const result = await pool.query(
      `INSERT INTO puestos (sucursal_id, nombre, minima_cobertura)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [sucursal_id, nombre, minima_cobertura]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;