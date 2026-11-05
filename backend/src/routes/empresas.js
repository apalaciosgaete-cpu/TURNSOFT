const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// Listar empresas
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, razon_social, rut_empresa, jornada_maxima_semanal, descanso_minimo_entre_turnos, horas_extras_max_diarias, recargo_dominical_festivo, creado_en, actualizado_en FROM empresas ORDER BY razon_social'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear empresa
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { razon_social, rut_empresa, jornada_maxima_semanal = 44, descanso_minimo_entre_turnos = 12, horas_extras_max_diarias = 2, recargo_dominical_festivo = 50.00 } = req.body;

    const result = await pool.query(
      `INSERT INTO empresas (razon_social, rut_empresa, jornada_maxima_semanal, descanso_minimo_entre_turnos, horas_extras_max_diarias, recargo_dominical_festivo)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [razon_social, rut_empresa, jornada_maxima_semanal, descanso_minimo_entre_turnos, horas_extras_max_diarias, recargo_dominical_festivo]
    );

    // Crear configuración legal por defecto
    await pool.query(
      `INSERT INTO configuracion_legal (empresa_id, jornada_maxima_semanal, descanso_minimo_entre_turnos, horas_extras_max_diarias, recargo_dominical_festivo)
       VALUES ($1, $2, $3, $4, $5)`,
      [result.rows[0].id, jornada_maxima_semanal, descanso_minimo_entre_turnos, horas_extras_max_diarias, recargo_dominical_festivo]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener empresa por ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM empresas WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar configuración legal
router.put('/:id/configuracion-legal', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { jornada_maxima_semanal, descanso_minimo_entre_turnos, horas_extras_max_diarias, recargo_dominical_festivo } = req.body;

    const result = await pool.query(
      `UPDATE configuracion_legal 
       SET jornada_maxima_semanal = $1, descanso_minimo_entre_turnos = $2, horas_extras_max_diarias = $3, recargo_dominical_festivo = $4, actualizado_en = NOW()
       WHERE empresa_id = $5
       RETURNING *`,
      [jornada_maxima_semanal, descanso_minimo_entre_turnos, horas_extras_max_diarias, recargo_dominical_festivo, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Configuración no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;