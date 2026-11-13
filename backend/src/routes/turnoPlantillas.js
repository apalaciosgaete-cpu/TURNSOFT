const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { requireOperator } = require('../middleware/tenant');

const COLORS = /^#[0-9a-fA-F]{6}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

function clean(value, max = 200) {
  return String(value ?? '').trim().slice(0, max);
}

function parseBody(body) {
  const nombre = clean(body.nombre, 100);
  const codigo = clean(body.codigo, 10) || null;
  const horaInicio = clean(body.hora_inicio, 8);
  const horaFin = clean(body.hora_fin, 8);
  const duracion = Number(body.duracion_horas);
  const minutosColacion = body.minutos_colacion === undefined ? 60 : Number(body.minutos_colacion);
  const color = clean(body.color, 20) || '#0f766e';
  const cobertura = Array.isArray(body.cobertura_semanal)
    ? body.cobertura_semanal.slice(0, 7).map((value) => Math.max(0, Math.min(20, Number(value) || 0)))
    : [1, 1, 1, 1, 1, 0, 0];
  const certificaciones = Array.isArray(body.certificaciones_requeridas)
    ? body.certificaciones_requeridas.map((item) => clean(item, 120)).filter(Boolean)
    : [];

  if (!nombre) throw Object.assign(new Error('Ingresa el nombre del horario.'), { status: 400 });
  if (!TIME_RE.test(horaInicio) || !TIME_RE.test(horaFin)) {
    throw Object.assign(new Error('Define una hora de entrada y salida válida.'), { status: 400 });
  }
  if (!Number.isFinite(duracion) || duracion <= 0 || duracion > 24) {
    throw Object.assign(new Error('La duración debe estar entre 1 y 24 horas.'), { status: 400 });
  }
  if (!Number.isFinite(minutosColacion) || minutosColacion < 0 || minutosColacion > 240) {
    throw Object.assign(new Error('La colación debe estar entre 0 y 240 minutos.'), { status: 400 });
  }
  if (!COLORS.test(color)) {
    throw Object.assign(new Error('El color del horario no es válido.'), { status: 400 });
  }

  return {
    nombre,
    codigo,
    hora_inicio: horaInicio,
    hora_fin: horaFin,
    duracion_horas: Math.round(duracion),
    requiere_colacion: body.requiere_colacion !== false,
    minutos_colacion: Math.round(minutosColacion),
    es_nocturno: Boolean(body.es_nocturno),
    color,
    cobertura_semanal: cobertura,
    certificaciones_requeridas: certificaciones,
  };
}

// Listar los horarios de entrada/salida de la empresa del usuario.
router.get('/', authenticateToken, async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    if (!empresaId) return res.json([]);
    const result = await pool.query(
      `SELECT * FROM turno_plantillas
       WHERE empresa_id = $1
       ORDER BY nombre`,
      [empresaId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('[turno-plantillas/list]', error);
    res.status(500).json({ error: 'No se pudieron cargar los horarios de la empresa.' });
  }
});

// Crear un horario base de la empresa.
router.post('/', authenticateToken, requireOperator, async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    if (!empresaId) {
      return res.status(400).json({ error: 'La cuenta no está asociada a una empresa.' });
    }
    const data = parseBody(req.body || {});
    const result = await pool.query(
      `INSERT INTO turno_plantillas
         (empresa_id, nombre, codigo, duracion_horas, hora_inicio, hora_fin,
          requiere_colacion, minutos_colacion, es_nocturno, color,
          cobertura_semanal, certificaciones_requeridas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        empresaId,
        data.nombre,
        data.codigo,
        data.duracion_horas,
        data.hora_inicio,
        data.hora_fin,
        data.requiere_colacion,
        data.minutos_colacion,
        data.es_nocturno,
        data.color,
        data.cobertura_semanal,
        data.certificaciones_requeridas,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('[turno-plantillas/create]', error);
    res.status(500).json({ error: 'No se pudo crear el horario.' });
  }
});

// Actualizar un horario base, siempre dentro de la misma empresa.
router.put('/:id', authenticateToken, requireOperator, async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    if (!empresaId) {
      return res.status(400).json({ error: 'La cuenta no está asociada a una empresa.' });
    }
    const data = parseBody(req.body || {});
    const result = await pool.query(
      `UPDATE turno_plantillas
       SET nombre = $1, codigo = $2, duracion_horas = $3, hora_inicio = $4,
           hora_fin = $5, requiere_colacion = $6, minutos_colacion = $7,
           es_nocturno = $8, color = $9, cobertura_semanal = $10,
           certificaciones_requeridas = $11
       WHERE id = $12 AND empresa_id = $13
       RETURNING *`,
      [
        data.nombre,
        data.codigo,
        data.duracion_horas,
        data.hora_inicio,
        data.hora_fin,
        data.requiere_colacion,
        data.minutos_colacion,
        data.es_nocturno,
        data.color,
        data.cobertura_semanal,
        data.certificaciones_requeridas,
        req.params.id,
        empresaId,
      ]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Horario no encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('[turno-plantillas/update]', error);
    res.status(500).json({ error: 'No se pudo actualizar el horario.' });
  }
});

router.delete('/:id', authenticateToken, requireOperator, async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    if (!empresaId) {
      return res.status(400).json({ error: 'La cuenta no está asociada a una empresa.' });
    }
    const result = await pool.query(
      'DELETE FROM turno_plantillas WHERE id = $1 AND empresa_id = $2 RETURNING id',
      [req.params.id, empresaId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Horario no encontrado.' });
    }
    res.json({ deleted: true });
  } catch (error) {
    console.error('[turno-plantillas/delete]', error);
    res.status(500).json({ error: 'No se pudo eliminar el horario.' });
  }
});

module.exports = router;
