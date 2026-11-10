const express = require('express');
const router = express.Router();
const scheduler = require('../services/scheduler');

/**
 * Rutas independientes de PostgreSQL para usar el motor compartido.
 * Sirven para integraciones, pruebas y para el frontend local-first.
 */

// Catálogo de sectores, presets de turnos/reglas y escenarios demo.
router.get('/presets', async (req, res, next) => {
  try {
    res.json(await scheduler.getPresets());
  } catch (error) {
    next(error);
  }
});

// Base legal usada por el motor: fuentes, catálogo de reglas e hitos.
router.get('/legal', async (req, res, next) => {
  try {
    res.json(await scheduler.getLegalCatalog());
  } catch (error) {
    next(error);
  }
});

// Genera un horario y devuelve también el reporte de cumplimiento.
router.post('/generar', async (req, res, next) => {
  try {
    const scenario = await scheduler.scenarioFromRequest(req.body || {});
    const result = await scheduler.plan(scenario, req.body?.options || {});
    res.json({
      scenario: result.scenario,
      schedule: result.schedule,
      validation: result.validation,
      configFindings: result.configFindings,
      summary: { ...result.validation.metrics },
    });
  } catch (error) {
    if (error instanceof Error && error.message) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

// Valida un horario existente. Si no se envía `schedule`, usa `scenario.schedule`.
router.post('/validar', async (req, res, next) => {
  try {
    const { scenario, schedule } = req.body || {};
    if (!scenario) {
      return res.status(400).json({ error: 'Se requiere el escenario a validar.' });
    }
    const shared = await scheduler.loadShared();
    const target = schedule || scenario.schedule || null;
    const validation = shared.validate.validateSchedule(scenario, target);
    res.json({
      scenarioId: scenario.id || null,
      hasSchedule: Boolean(target),
      validation,
      summary: validation.metrics,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
