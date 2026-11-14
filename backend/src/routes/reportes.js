const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { scopedClienteId, scopedEmpresaId } = require('../middleware/tenant');

// Reporte de cumplimiento legal por empresa, cliente y mes.
router.get('/cumplimiento', authenticateToken, async (req, res) => {
  try {
    const empresaId = scopedEmpresaId(req.user, req.query.empresa_id);
    const clienteId = scopedClienteId(req.user, req.query.cliente_id);
    const { mes } = req.query; // mes formato: 2026-11

    if (!empresaId || !mes) {
      return res.status(400).json({ error: 'empresa_id y mes son requeridos' });
    }

    const [anio, mesNum] = mes.split('-').map(Number);
    const inicioMes = new Date(anio, mesNum - 1, 1);
    const finMes = new Date(anio, mesNum, 0);

    const inicioStr = inicioMes.toISOString().split('T')[0];
    const finStr = finMes.toISOString().split('T')[0];

    // Horas semanales por guardia.
    const horasResult = await pool.query(
      `SELECT g.id AS guardia_id, g.nombre_completo, cl.nombre AS cliente_nombre,
              SUM(h.horas_trabajadas) AS total_horas,
              COUNT(*) AS dias_trabajados,
              SUM(CASE WHEN h.tipo_turno = 'domingo' THEN 1 ELSE 0 END) AS domingos_trabajados,
              SUM(CASE WHEN h.tipo_turno = 'festivo' THEN 1 ELSE 0 END) AS festivos_trabajados
       FROM horarios h
       JOIN guardias g ON g.id = h.guardia_id
       LEFT JOIN clientes cl ON cl.id = g.cliente_id
       WHERE g.empresa_id = $1
         AND h.fecha BETWEEN $2 AND $3
         AND h.estado = 'publicado'
         AND ($4::uuid IS NULL OR g.cliente_id = $4)
       GROUP BY g.id, g.nombre_completo, cl.nombre
       ORDER BY g.nombre_completo`,
      [empresaId, inicioStr, finStr, clienteId || null]
    );

    // Verificar descansos semanales (simplificado).
    const descansosResult = await pool.query(
      `SELECT d.guardia_id, g.nombre_completo, COUNT(*) AS descansos_semanales
       FROM descansos d
       JOIN guardias g ON g.id = d.guardia_id
       WHERE d.tipo = 'semanal'
         AND d.fecha BETWEEN $1 AND $2
         AND ($3::uuid IS NULL OR g.empresa_id = $3)
         AND ($4::uuid IS NULL OR g.cliente_id = $4)
       GROUP BY d.guardia_id, g.nombre_completo`,
      [inicioStr, finStr, empresaId, clienteId || null]
    );

    // Verificar certificaciones OS-10 vencidas.
    const os10Result = await pool.query(
      `SELECT g.id, g.nombre_completo, c.numero_certificado, c.fecha_vencimiento,
              cl.nombre AS cliente_nombre
       FROM guardias g
       JOIN certificaciones_os10 c ON c.guardia_id = g.id
       LEFT JOIN clientes cl ON cl.id = g.cliente_id
       WHERE g.empresa_id = $1
         AND g.activo = true
         AND c.fecha_vencimiento < CURRENT_DATE
         AND ($2::uuid IS NULL OR g.cliente_id = $2)`,
      [empresaId, clienteId || null]
    );

    res.json({
      periodo: mes,
      empresa_id: empresaId,
      cliente_id: clienteId || null,
      resumen_por_guardia: horasResult.rows,
      descansos_semanales: descansosResult.rows,
      os10_vencidas: os10Result.rows,
      generado_en: new Date(),
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
