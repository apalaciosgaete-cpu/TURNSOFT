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
      `SELECT e.id, e.razon_social, e.rut_empresa, e.sector, e.regimen_jornada,
              e.autorizacion_excepcional, e.referencia_autorizacion, e.notas,
              e.jornada_maxima_semanal, e.descanso_minimo_entre_turnos,
              e.horas_extras_max_diarias, e.recargo_dominical_festivo,
              e.email_contacto, e.telefono, e.direccion, e.ciudad,
              e.estado, e.plan_id, e.prueba_inicio, e.prueba_fin,
              e.creado_en, e.actualizado_en,
              p.nombre AS plan_nombre, p.precio_mensual
       FROM empresas e
       LEFT JOIN planes p ON p.id = e.plan_id
       WHERE ($1::uuid IS NULL OR e.id = $1)
       ORDER BY e.razon_social`,
      [empresaId || null]
    );
    res.json(result.rows);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar los datos de la empresa. Solo el administrador de la empresa puede
// editar su propia ficha; el supervisor no crea empresas desde esta ruta.
router.patch('/:id', authenticateToken, requireOperator, async (req, res) => {
  try {
    assertEmpresaAccess(req.user, req.params.id);

    const SECTORES = new Set(['seguridad', 'salud', 'mineria', 'retail', 'logistica']);
    const sets = [];
    const values = [];

    const fields = [
      ['razon_social', 200],
      ['rut_empresa', 12],
      ['sector', 20],
      ['email_contacto', 200],
      ['telefono', 50],
      ['direccion', 500],
      ['ciudad', 100],
      ['notas', 2000],
    ];

    for (const [field, max] of fields) {
      if (req.body[field] === undefined) continue;
      let value = String(req.body[field] ?? '').trim().slice(0, max);
      if (field === 'rut_empresa') {
        value = value.replace(/\./g, '').replace(/\s/g, '').toUpperCase();
        if (!/^\d{6,8}-[0-9kK]$/.test(value)) {
          return res.status(400).json({ error: 'Ingresa un RUT válido, por ejemplo 76.123.456-7.' });
        }
      }
      if (field === 'razon_social' && !value) {
        return res.status(400).json({ error: 'La razón social no puede quedar vacía.' });
      }
      if (field === 'sector' && !SECTORES.has(value.toLowerCase())) {
        return res.status(400).json({ error: 'Selecciona un sector válido.' });
      }
      if (field === 'email_contacto' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return res.status(400).json({ error: 'Ingresa un correo de contacto válido.' });
      }
      values.push(value || null);
      sets.push(`${field} = $${values.length}`);
    }

    if (!sets.length) {
      return res.status(400).json({ error: 'No se enviaron cambios para la empresa.' });
    }

    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE empresas
       SET ${sets.join(', ')}, actualizado_en = NOW()
       WHERE id = $${values.length}
       RETURNING id, razon_social, rut_empresa, sector, email_contacto,
                 telefono, direccion, ciudad, notas, estado, plan_id,
                 prueba_fin, actualizado_en`,
      values
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Empresa no encontrada.' });
    }
    return res.json(result.rows[0]);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe otra empresa con ese RUT.' });
    }
    console.error('[empresas/patch]', error);
    return res.status(500).json({ error: 'No se pudieron guardar los datos de la empresa.' });
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
    res.status(500).json({ error: 'Error interno del servidor' });
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
    res.status(500).json({ error: 'Error interno del servidor' });
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
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
