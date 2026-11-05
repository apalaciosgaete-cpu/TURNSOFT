const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// Listar plantillas de turno
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM turno_plantillas ORDER BY nombre');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear plantilla de turno
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { nombre, duracion_horas, hora_inicio, hora_fin, requiere_colacion = true, es_nocturno = false } = req.body;

    const result = await pool.query(
      `INSERT INTO turno_plantillas (nombre, duracion_horas, hora_inicio, hora_fin, requiere_colacion, es_nocturno)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [nombre, duracion_horas, hora_inicio, hora_fin, requiere_colacion, es_nocturno]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;