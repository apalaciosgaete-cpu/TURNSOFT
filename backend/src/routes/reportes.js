const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// Reporte de cumplimiento legal por empresa y mes
router.get('/cumplimiento', authenticateToken, async (req, res) => {
  try {
    const { empresa_id, mes } = req.query; // mes formato: 2026-11

    if (!empresa_id || !mes) {
      return res.status(400).json({ error: 'empresa_id y mes son requeridos' });
    }

    const [anio, mesNum] = mes.split('-').map(Number);
    const inicioMes = new Date(anio, mesNum - 1, 1);
    const finMes = new Date(anio, mesNum, 0);

    const inicioStr = inicioMes.toISOString().split('T')[0];
    const finStr = finMes.toISOString().split('T')[0];

    // Horas semanales por guardia
    const horasResult = await pool.query(
      `SELECT g.id as guardia_id, g.nombre_completo,
              SUM(h.horas_trabajadas) as total_horas,
              COUNT(*) as dias_trabajados,
              SUM(CASE WHEN h.tipo_turno = 'domingo' THEN 1 ELSE 0 END) as domingos_trabajados,
              SUM(CASE WHEN h.tipo_turno = 'festivo' THEN 1 ELSE 0 END) as festivos_trabajados
       FROM horarios h
       JOIN guardias g ON g.id = h.guardia_id
       WHERE g.empresa_id = $1 AND h.fecha BETWEEN $2 AND $3 AND h.estado = 'publicado'
       GROUP BY g.id, g.nombre_completo
       ORDER BY g.nombre_completo`,
      [empresa_id, inicioStr, finStr]
    );

    // Verificar descansos semanales (simplificado)
    const descansosResult = await pool.query(
      `SELECT guardia_id, COUNT(*) as descansos_semanales
       FROM descansos
       WHERE tipo = 'semanal' AND fecha BETWEEN $1 AND $2
       GROUP BY guardia_id`,
      [inicioStr, finStr]
    );

    // Verificar certificaciones OS-10 vencidas
    const os10Result = await pool.query(
      `SELECT g.id, g.nombre_completo, c.numero_certificado, c.fecha_vencimiento
       FROM guardias g
       JOIN certificaciones_os10 c ON c.guardia_id = g.id
       WHERE g.empresa_id = $1 AND g.activo = true AND c.fecha_vencimiento < CURRENT_DATE`,
      [empresa_id]
    );

    res.json({
      periodo: mes,
      empresa_id,
      resumen_por_guardia: horasResult.rows,
      descansos_semanales: descansosResult.rows,
      os10_vencidas: os10Result.rows,
      generado_en: new Date()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;