const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// Generar horarios (motor de reglas básico)
router.post('/generar', authenticateToken, async (req, res) => {
  try {
    const { empresa_id, sucursal_id, fecha_inicio, fecha_fin } = req.body;

    if (!empresa_id || !fecha_inicio || !fecha_fin) {
      return res.status(400).json({ error: 'empresa_id, fecha_inicio y fecha_fin son requeridos' });
    }

    // Obtener configuración legal de la empresa
    const configResult = await pool.query(
      'SELECT * FROM configuracion_legal WHERE empresa_id = $1',
      [empresa_id]
    );
    const config = configResult.rows[0] || {
      jornada_maxima_semanal: 44,
      descanso_minimo_entre_turnos: 12,
      horas_extras_max_diarias: 2,
      recargo_dominical_festivo: 50.00
    };

    // Obtener guardias activos de la empresa con OS-10 vigente
    const guardiasResult = await pool.query(
      `SELECT g.*, c.fecha_vencimiento 
       FROM guardias g
       LEFT JOIN certificaciones_os10 c ON c.guardia_id = g.id
       WHERE g.empresa_id = $1 AND g.activo = true
       ORDER BY g.nombre_completo`,
      [empresa_id]
    );

    const guardias = guardiasResult.rows.filter(g => {
      if (!g.fecha_vencimiento) return false;
      return new Date(g.fecha_vencimiento) >= new Date();
    });

    // Obtener puestos de la sucursal
    const puestosResult = await pool.query(
      'SELECT * FROM puestos WHERE sucursal_id = $1 ORDER BY nombre',
      [sucursal_id]
    );

    const puestos = puestosResult.rows;

    // Generar horarios simples (asignación round-robin básica)
    const horarios = [];
    const inicio = new Date(fecha_inicio);
    const fin = new Date(fecha_fin);

    for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
      const fechaStr = d.toISOString().split('T')[0];
      const diaSemana = d.getDay(); // 0=Domingo, 1=Lunes...

      for (const puesto of puestos) {
        // Asignar guardia rotativo simple
        const guardiaIndex = horarios.length % guardias.length;
        const guardia = guardias[guardiaIndex];

        if (!guardia) continue;

        const horaInicio = new Date(`${fechaStr}T08:00:00`);
        const horaFin = new Date(`${fechaStr}T16:00:00`);
        const horasTrabajadas = 8;

        horarios.push({
          guardia_id: guardia.id,
          puesto_id: puesto.id,
          fecha: fechaStr,
          hora_inicio: horaInicio.toISOString(),
          hora_fin: horaFin.toISOString(),
          horas_trabajadas: horasTrabajadas,
          tipo_turno: diaSemana === 0 ? 'domingo' : 'ordinario',
          estado: 'borrador'
        });
      }
    }

    // Insertar horarios en la base de datos
    const insertados = [];
    for (const h of horarios) {
      const result = await pool.query(
        `INSERT INTO horarios (guardia_id, puesto_id, fecha, hora_inicio, hora_fin, horas_trabajadas, tipo_turno, estado)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [h.guardia_id, h.puesto_id, h.fecha, h.hora_inicio, h.hora_fin, h.horas_trabajadas, h.tipo_turno, h.estado]
      );
      insertados.push(result.rows[0]);
    }

    res.json({
      message: 'Horarios generados correctamente',
      configuracion_legal: config,
      total_generados: insertados.length,
      horarios: insertados
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Obtener horarios semanales
router.get('/semanal', authenticateToken, async (req, res) => {
  try {
    const { empresa_id, semana } = req.query;
    // semana formato: 2026-W45
    let query = `SELECT h.*, g.nombre_completo as guardia_nombre, p.nombre as puesto_nombre
                 FROM horarios h
                 JOIN guardias g ON g.id = h.guardia_id
                 JOIN puestos p ON p.id = h.puesto_id
                 WHERE h.estado = 'borrador'`;
    const params = [];

    if (empresa_id) {
      query += ` AND g.empresa_id = $${params.length + 1}`;
      params.push(empresa_id);
    }

    query += ` ORDER BY h.fecha, h.hora_inicio`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Publicar horarios
router.post('/publicar', authenticateToken, async (req, res) => {
  try {
    const { horario_ids } = req.body;

    if (!Array.isArray(horario_ids) || horario_ids.length === 0) {
      return res.status(400).json({ error: 'horario_ids es requerido' });
    }

    const result = await pool.query(
      `UPDATE horarios SET estado = 'publicado', actualizado_en = NOW() WHERE id = ANY($1) RETURNING *`,
      [horario_ids]
    );

    res.json({ message: 'Horarios publicados', horarios: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;