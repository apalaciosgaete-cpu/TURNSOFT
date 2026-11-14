const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const {
  scopedClienteId,
  scopedEmpresaId,
  httpError,
} = require('../middleware/tenant');
const scheduler = require('../services/scheduler');

function daysBetween(start, end) {
  const from = new Date(`${start}T00:00:00Z`);
  const to = new Date(`${end}T00:00:00Z`);
  return Math.floor((to - from) / 86400000) + 1;
}

function isValidPeriod(days) {
  return Number.isInteger(days) && days >= 1 && days <= 120;
}

async function loadScenarioData({
  empresaId,
  clienteId,
  sucursalId,
  startDate,
  days,
  sector,
  notes,
}) {
  const empresaResult = await pool.query('SELECT * FROM empresas WHERE id = $1', [empresaId]);
  if (!empresaResult.rows.length) {
    throw httpError(404, 'Empresa no encontrada.');
  }
  const empresa = empresaResult.rows[0];

  let cliente = null;
  if (clienteId) {
    const clienteResult = await pool.query(
      `SELECT * FROM clientes
       WHERE id = $1 AND empresa_id = $2 AND activo = true`,
      [clienteId, empresaId]
    );
    if (!clienteResult.rows.length) {
      throw httpError(404, 'Cliente no encontrado para esta empresa.');
    }
    cliente = clienteResult.rows[0];
  }

  let sucursal = null;
  if (sucursalId) {
    const result = await pool.query(
      `SELECT * FROM sucursales
       WHERE id = $1 AND empresa_id = $2
         AND ($3::uuid IS NULL OR cliente_id = $3)`,
      [sucursalId, empresaId, clienteId || null]
    );
    if (!result.rows.length) {
      throw httpError(404, 'Sucursal no encontrada para el cliente indicado.');
    }
    sucursal = result.rows[0];
  } else {
    const result = await pool.query(
      `SELECT * FROM sucursales
       WHERE empresa_id = $1 AND ($2::uuid IS NULL OR cliente_id = $2)
       ORDER BY nombre LIMIT 1`,
      [empresaId, clienteId || null]
    );
    sucursal = result.rows[0] || null;
  }

  if (!sucursal) {
    throw httpError(400, 'La empresa no tiene sucursales registradas para esta cuenta.');
  }

  const configResult = await pool.query(
    'SELECT * FROM configuracion_legal WHERE empresa_id = $1',
    [empresaId]
  );

  const guardiasResult = await pool.query(
    `SELECT g.*,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', c.id,
                  'name', 'OS-10',
                  'expiresAt', c.fecha_vencimiento,
                  'issuer', c.emitido_por
                )
              ) FILTER (WHERE c.id IS NOT NULL),
              '[]'::json
            ) AS certificaciones
     FROM guardias g
     LEFT JOIN certificaciones_os10 c ON c.guardia_id = g.id
     WHERE g.empresa_id = $1
       AND g.activo = true
       AND ($2::uuid IS NULL OR g.cliente_id = $2)
     GROUP BY g.id
     ORDER BY g.nombre_completo`,
    [empresaId, clienteId || null]
  );

  const puestosResult = await pool.query(
    `SELECT p.*,
            t.nombre AS plantilla_nombre,
            t.codigo AS plantilla_codigo,
            t.hora_inicio,
            t.hora_fin,
            t.requiere_colacion,
            t.es_nocturno,
            t.minutos_colacion,
            t.color AS plantilla_color,
            t.cobertura_semanal AS plantilla_cobertura,
            t.certificaciones_requeridas AS plantilla_certificaciones
     FROM puestos p
     LEFT JOIN turno_plantillas t ON t.id = p.turno_plantilla_id
     WHERE p.sucursal_id = $1
     ORDER BY p.nombre`,
    [sucursal.id]
  );

  if (!puestosResult.rows.length) {
    throw httpError(400, 'La sucursal no tiene puestos configurados.');
  }

  return scheduler.buildScenarioFromDb({
    empresa,
    cliente,
    sucursal,
    config: configResult.rows[0] || null,
    guardias: guardiasResult.rows,
    puestos: puestosResult.rows,
    startDate,
    days,
    sector,
    notes,
  });
}

async function persistScenario({
  empresaId,
  clienteId,
  sucursalId,
  scenario,
  schedule,
  validation,
  estado = 'borrador',
}) {
  const client = await pool.connect();
  let escenarioId = null;
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO escenarios_horario
         (empresa_id, cliente_id, sucursal_id, nombre, sector, fecha_inicio, dias, estado,
          configuracion, horario, validacion, huella, generado_en)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
       RETURNING id`,
      [
        empresaId || null,
        clienteId || null,
        sucursalId || null,
        scenario.name,
        scenario.sector,
        scenario.startDate,
        scenario.days,
        estado,
        JSON.stringify({ ...scenario, schedule: null }),
        JSON.stringify(schedule),
        JSON.stringify(validation),
        schedule?.meta?.fingerprint || null,
      ]
    );
    escenarioId = inserted.rows[0].id;

    const rows = await scheduler.assignmentsToRows(scenario, schedule, { escenarioId });
    for (const row of rows) {
      await client.query(
        `INSERT INTO horarios
           (escenario_id, guardia_id, puesto_id, fecha, hora_inicio, hora_fin,
            horas_trabajadas, tipo_turno, estado)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          row.escenario_id,
          row.guardia_id,
          row.puesto_id,
          row.fecha,
          row.hora_inicio,
          row.hora_fin,
          row.horas_trabajadas,
          row.tipo_turno,
          row.estado,
        ]
      );
    }

    // El borrador anterior se conserva como histórico, pero solo dentro de la
    // misma cuenta (empresa + cliente + sucursal). Nunca se toca otro cliente.
    await client.query(
      `UPDATE escenarios_horario
       SET estado = 'historico', actualizado_en = NOW()
       WHERE id <> $1
         AND empresa_id IS NOT DISTINCT FROM $2
         AND cliente_id IS NOT DISTINCT FROM $3
         AND sucursal_id IS NOT DISTINCT FROM $4
         AND estado = 'borrador'`,
      [escenarioId, empresaId || null, clienteId || null, sucursalId || null]
    );

    await client.query('COMMIT');
    return { persisted: true, escenarioId, clienteId: clienteId || null, assignments: rows.length };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Generar horario.
 *
 * Dos formas de uso:
 * 1. `{ scenario }`: usa un escenario completo (mismo formato del frontend).
 * 2. `{ empresa_id, cliente_id, sucursal_id?, fecha_inicio, fecha_fin? | dias? }`:
 *    arma el escenario desde PostgreSQL y persiste el resultado.
 *
 * En ambos casos el token manda: una cuenta de cliente solo puede generar y
 * persistir datos de su propio cliente.
 */
router.post('/generar', authenticateToken, async (req, res) => {
  try {
    const body = req.body || {};
    const scenarioInput = body.scenario && typeof body.scenario === 'object' ? body.scenario : null;
    const empresaId = scopedEmpresaId(req.user, body.empresa_id || scenarioInput?.empresaId);
    const clienteId = scopedClienteId(
      req.user,
      body.cliente_id || scenarioInput?.clientId || scenarioInput?.cliente_id
    );
    let scenario;

    if (scenarioInput) {
      scenario = await scheduler.scenarioFromRequest({ ...body, scenario: scenarioInput });
      scenario = {
        ...scenario,
        clientId: clienteId || scenario.clientId || null,
        clienteId: clienteId || scenario.clienteId || null,
      };
    } else {
      const { sucursal_id, fecha_inicio, fecha_fin, dias, sector, notes } = body;
      if (!empresaId || !fecha_inicio) {
        return res.status(400).json({
          error: 'empresa_id y fecha_inicio son requeridos (o envía un objeto scenario).',
        });
      }
      const days = dias
        ? Number(dias)
        : fecha_fin
          ? daysBetween(fecha_inicio, fecha_fin)
          : 28;
      if (!isValidPeriod(days)) {
        return res.status(400).json({ error: 'El período debe estar entre 1 y 120 días.' });
      }
      scenario = await loadScenarioData({
        empresaId,
        clienteId,
        sucursalId: sucursal_id,
        startDate: fecha_inicio,
        days,
        sector,
        notes,
      });
    }

    if (!scenario.employees?.length) {
      return res.status(400).json({ error: 'La cuenta no tiene trabajadores activos.' });
    }
    if (!scenario.shifts?.length) {
      return res.status(400).json({ error: 'El escenario no tiene turnos o puestos configurados.' });
    }

    const result = await scheduler.plan(scenario, body.options || {});

    let persistence = { persisted: false, reason: 'sin_persistencia' };
    try {
      persistence = await persistScenario({
        empresaId: empresaId || scenario.empresaId || null,
        clienteId: clienteId || scenario.clienteId || scenario.clientId || null,
        sucursalId: body.sucursal_id || scenario.sucursalId || null,
        scenario,
        schedule: result.schedule,
        validation: result.validation,
        estado: body.estado === 'publicado' ? 'publicado' : 'borrador',
      });
    } catch (error) {
      persistence = {
        persisted: false,
        reason: 'base_de_datos_no_disponible',
      };
    }

    res.json({
      message: 'Horario generado y validado con el motor TURNSOFT.',
      scenario: result.scenario,
      schedule: result.schedule,
      validation: result.validation,
      configFindings: result.configFindings,
      summary: result.validation.metrics,
      persistence,
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('[horarios/generar]', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener horarios semanales (tabla legacy `horarios`).
router.get('/semanal', authenticateToken, async (req, res) => {
  try {
    const empresaId = scopedEmpresaId(req.user, req.query.empresa_id);
    const clienteId = scopedClienteId(req.user, req.query.cliente_id);
    const result = await pool.query(
      `SELECT h.*, g.nombre_completo AS guardia_nombre, g.cliente_id,
              p.nombre AS puesto_nombre, c.nombre AS cliente_nombre
       FROM horarios h
       JOIN guardias g ON g.id = h.guardia_id
       JOIN puestos p ON p.id = h.puesto_id
       LEFT JOIN clientes c ON c.id = g.cliente_id
       WHERE h.estado = 'borrador'
         AND ($1::uuid IS NULL OR g.empresa_id = $1)
         AND ($2::uuid IS NULL OR g.cliente_id = $2)
         AND ($3::uuid IS NULL OR h.escenario_id = $3)
       ORDER BY h.fecha, h.hora_inicio`,
      [empresaId || null, clienteId || null, req.query.escenario_id || null]
    );
    res.json(result.rows);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Listar escenarios guardados con su resumen de cumplimiento.
router.get('/escenarios', authenticateToken, async (req, res) => {
  try {
    const empresaId = scopedEmpresaId(req.user, req.query.empresa_id);
    const clienteId = scopedClienteId(req.user, req.query.cliente_id);
    const result = await pool.query(
      `SELECT e.id, e.empresa_id, e.cliente_id, e.sucursal_id, e.nombre, e.sector,
              e.fecha_inicio, e.dias, e.estado, e.huella, e.generado_en, e.actualizado_en,
              c.nombre AS cliente_nombre,
              (e.validacion->'metrics') AS metricas
       FROM escenarios_horario e
       LEFT JOIN clientes c ON c.id = e.cliente_id
       WHERE ($1::uuid IS NULL OR e.empresa_id = $1)
         AND ($2::uuid IS NULL OR e.cliente_id = $2)
       ORDER BY e.generado_en DESC`,
      [empresaId || null, clienteId || null]
    );
    res.json(result.rows);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener un escenario completo guardado, con horario y validación.
router.get('/escenarios/:id', authenticateToken, async (req, res) => {
  try {
    const empresaId = scopedEmpresaId(req.user, req.query.empresa_id);
    const clienteId = scopedClienteId(req.user, req.query.cliente_id);
    const result = await pool.query(
      `SELECT e.*, c.nombre AS cliente_nombre
       FROM escenarios_horario e
       LEFT JOIN clientes c ON c.id = e.cliente_id
       WHERE e.id = $1
         AND ($2::uuid IS NULL OR e.empresa_id = $2)
         AND ($3::uuid IS NULL OR e.cliente_id = $3)`,
      [req.params.id, empresaId || null, clienteId || null]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Escenario no encontrado.' });
    res.json(result.rows[0]);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Publicar un escenario guardado y sus asignaciones.
router.post('/escenarios/:id/publicar', authenticateToken, async (req, res) => {
  try {
    const empresaId = scopedEmpresaId(req.user, req.body?.empresa_id || req.query.empresa_id);
    const clienteId = scopedClienteId(req.user, req.body?.cliente_id || req.query.cliente_id);
    const result = await pool.query(
      `UPDATE escenarios_horario
       SET estado = 'publicado', actualizado_en = NOW()
       WHERE id = $1
         AND ($2::uuid IS NULL OR empresa_id = $2)
         AND ($3::uuid IS NULL OR cliente_id = $3)
       RETURNING id, estado, empresa_id, cliente_id`,
      [req.params.id, empresaId || null, clienteId || null]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Escenario no encontrado.' });
    await pool.query(
      `UPDATE horarios SET estado = 'publicado', actualizado_en = NOW()
       WHERE escenario_id = $1`,
      [req.params.id]
    );
    res.json({ message: 'Escenario publicado.', escenario: result.rows[0] });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Publicar horarios por ID (compatibilidad con el flujo anterior).
router.post('/publicar', authenticateToken, async (req, res) => {
  try {
    const { horario_ids } = req.body;
    const empresaId = scopedEmpresaId(req.user, req.body?.empresa_id);
    const clienteId = scopedClienteId(req.user, req.body?.cliente_id);

    if (!Array.isArray(horario_ids) || horario_ids.length === 0) {
      return res.status(400).json({ error: 'horario_ids es requerido' });
    }

    const result = await pool.query(
      `UPDATE horarios h
       SET estado = 'publicado', actualizado_en = NOW()
       FROM guardias g
       WHERE g.id = h.guardia_id
         AND h.id = ANY($1::uuid[])
         AND ($2::uuid IS NULL OR g.empresa_id = $2)
         AND ($3::uuid IS NULL OR g.cliente_id = $3)
       RETURNING h.*`,
      [horario_ids, empresaId || null, clienteId || null]
    );

    res.json({ message: 'Horarios publicados', horarios: result.rows });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
