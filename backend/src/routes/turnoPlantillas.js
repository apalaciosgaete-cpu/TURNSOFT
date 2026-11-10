const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { requireOperator } = require('../middleware/tenant');

// Listar plantillas de turno. Es un catálogo compartido por la operación.
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM turno_plantillas ORDER BY nombre');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear plantilla de turno. Solo el operador administra el catálogo global.
router.post('/', authenticateToken, requireOperator, async (req, res) => {
  try {
    const {
      nombre,
      duracion_horas,
      hora_inicio,
      hora_fin,
      requiere_colacion = true,
      es_nocturno = false,
      codigo = null,
      color = '#0f766e',
      minutos_colacion = 60,
      cobertura_semanal = [1, 1, 1, 1, 1, 0, 0],
      certificaciones_requeridas = [],
    } = req.body;

    const result = await pool.query(
      `INSERT INTO turno_plantillas
         (nombre, duracion_horas, hora_inicio, hora_fin, requiere_colacion, es_nocturno,
          codigo, color, minutos_colacion, cobertura_semanal, certificaciones_requeridas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        nombre,
        duracion_horas,
        hora_inicio,
        hora_fin,
        requiere_colacion,
        es_nocturno,
        codigo,
        color,
        minutos_colacion,
        cobertura_semanal,
        certificaciones_requeridas,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;