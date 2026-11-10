const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const {
  requireOperator,
  assertEmpresaAccess,
  scopedEmpresaId,
} = require('../middleware/tenant');

const LEGAL_FIELDS = [
  'jornada_maxima_semanal',
  'descanso_minimo_entre_turnos',
  'horas_extras_max_diarias',
  'recargo_dominical_festivo',
  'max_daily_hours',
  'max_exceptional_daily_hours',
  'max_exceptional_average_weekly_hours',
  'max_consecutive_work_days',
  'block_rest_days',
  'min_sundays_off_per_month',
  'max_consecutive_night_shifts',
  'allow_sunday_work',
  'allow_holiday_work',
  'require_certifications',
  'require_full_coverage',
  'recargo_festivo',
];

// Listar empresas visibles para la cuenta.
router.get('/', authenticateToken, async (req, res) => {
  try {
    const empresaId = scopedEmpresaId(req.user, req.query.empresa_id);
    const result = await pool.query(
      `SELECT id, razon_social, rut_empresa, sector, regimen_jornada,
              autorizacion_excepcional, referencia_autorizacion, notas,
              jornada_maxima_semanal, descanso_minimo_entre_turnos,
              horas_extras_max_diarias, recargo_dominical_festivo,
              creado_en, actualizado_en
       FROM empresas
       WHERE ($1::uuid IS NULL OR id = $1)
       ORDER BY razon_social`,
      [empresaId || null]
    );
    res.json(result.rows);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Crear empresa. Solo el operador puede dar de alta una empresa.
router.post('/', authenticateToken, requireOperator, async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      razon_social,
      rut_empresa,
      sector = 'seguridad',
      regimen_jornada = 'ordinaria',
      autorizacion_excepcional = false,
      referencia_autorizacion = null,
      notas = null,
      jornada_maxima_semanal = 42,
      descanso_minimo_entre_turnos = 12,
      horas_extras_max_diarias = 2,
      recargo_dominical_festivo = 30.0,
    } = req.body;

    if (!razon_social || !rut_empresa) {
      return res.status(400).json({ error: 'razon_social y rut_empresa son requeridos' });
    }

    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO empresas
         (razon_social, rut_empresa, sector, regimen_jornada, autorizacion_excepcional,
          referencia_autorizacion, notas, jornada_maxima_semanal,
          descanso_minimo_entre_turnos, horas_extras_max_diarias, recargo_dominical_festivo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        razon_social,
        rut_empresa,
        sector,
        regimen_jornada,
        Boolean(autorizacion_excepcional),
        referencia_autorizacion,
        notas,
        jornada_maxima_semanal,
        descanso_minimo_entre_turnos,
        horas_extras_max_diarias,
        recargo_dominical_festivo,
      ]
    );

    const empresaId = result.rows[0].id;
    const legalFallbacks = {
      jornada_maxima_semanal,
      descanso_minimo_entre_turnos,
      horas_extras_max_diarias,
      recargo_dominical_festivo,
    };
    const legalValues = LEGAL_FIELDS.map(
      (field) => req.body[field] ?? legalFallbacks[field] ?? null
    );
    const legalColumns = LEGAL_FIELDS.join(', ');
    const placeholders = LEGAL_FIELDS.map((_, index) => `$${index + 2}`).join(', ');
    await client.query(
      `INSERT INTO configuracion_legal (empresa_id, ${legalColumns})
       VALUES ($1, ${placeholders})`,
      [empresaId, ...legalValues]
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Obtener empresa por ID.
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    assertEmpresaAccess(req.user, req.params.id);
    const result = await pool.query('SELECT * FROM empresas WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Obtener configuración legal.
router.get('/:id/configuracion-legal', authenticateToken, async (req, res) => {
  try {
    assertEmpresaAccess(req.user, req.params.id);
    const result = await pool.query(
      'SELECT * FROM configuracion_legal WHERE empresa_id = $1',
      [req.params.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Configuración no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Actualizar configuración legal (solo los campos enviados).
router.put('/:id/configuracion-legal', authenticateToken, requireOperator, async (req, res) => {
  try {
    assertEmpresaAccess(req.user, req.params.id);
    const updates = [];
    const values = [];
    for (const field of LEGAL_FIELDS) {
      if (req.body[field] === undefined) continue;
      values.push(req.body[field]);
      updates.push(`${field} = $${values.length}`);
    }
    if (!updates.length) {
      return res.status(400).json({ error: 'No se enviaron campos de configuración legal.' });
    }

    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE configuracion_legal
       SET ${updates.join(', ')}, actualizado_en = NOW()
       WHERE empresa_id = $${values.length}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Configuración no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
