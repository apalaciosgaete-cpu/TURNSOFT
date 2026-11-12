const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const {
  requireOperator,
  assertClienteAccess,
  scopedClienteId,
  scopedEmpresaId,
  httpError,
} = require('../middleware/tenant');

const CLIENT_FIELDS = [
  'nombre',
  'razon_social',
  'rut',
  'sector',
  'contacto',
  'email',
  'telefono',
  'direccion',
  'ciudad',
  'color',
  'activo',
];

// Listar clientes visibles para la cuenta.
router.get('/', authenticateToken, async (req, res) => {
  try {
    const empresaId = scopedEmpresaId(req.user, req.query.empresa_id);
    const clienteId = scopedClienteId(req.user, req.query.cliente_id);
    const result = await pool.query(
      `SELECT c.*, e.razon_social AS empresa_nombre,
              (SELECT count(*)::int FROM escenarios_horario s WHERE s.cliente_id = c.id) AS escenarios,
              (SELECT count(*)::int FROM sucursales su WHERE su.cliente_id = c.id) AS sucursales
       FROM clientes c
       JOIN empresas e ON e.id = c.empresa_id
       WHERE ($1::uuid IS NULL OR c.empresa_id = $1)
         AND ($2::uuid IS NULL OR c.id = $2)
       ORDER BY c.nombre`,
      [empresaId, clienteId]
    );
    res.json(result.rows);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Obtener un cliente.
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    assertClienteAccess(req.user, req.params.id);
    const result = await pool.query(
      `SELECT c.*, e.razon_social AS empresa_nombre
       FROM clientes c
       JOIN empresas e ON e.id = c.empresa_id
       WHERE c.id = $1
         AND ($2::uuid IS NULL OR c.empresa_id = $2)`,
      [req.params.id, req.user?.empresa_id || null]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Cliente no encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Crear cliente. Solo operador de la empresa.
router.post('/', authenticateToken, requireOperator, async (req, res) => {
  try {
    const empresaId = scopedEmpresaId(req.user, req.body.empresa_id);
    if (!empresaId) {
      return res.status(400).json({ error: 'La empresa operadora es requerida.' });
    }
    if (!req.body.nombre) {
      return res.status(400).json({ error: 'El nombre del cliente es requerido.' });
    }

    const limitResult = await pool.query(
      `SELECT p.max_clientes
       FROM empresas e
       LEFT JOIN planes p ON p.id = e.plan_id
       WHERE e.id = $1`,
      [empresaId]
    );
    const planLimit = limitResult.rows[0]?.max_clientes;
    if (planLimit !== null && planLimit !== undefined) {
      const countResult = await pool.query(
        'SELECT count(*)::int AS total FROM clientes WHERE empresa_id = $1',
        [empresaId]
      );
      if (countResult.rows[0].total >= planLimit) {
        return res.status(403).json({
          error: `Tu plan permite hasta ${planLimit} clientes. Amplía el plan para agregar más.`,
          code: 'PLAN_LIMIT',
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO clientes
         (empresa_id, nombre, razon_social, rut, sector, contacto, email, telefono,
          direccion, ciudad, color, activo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        empresaId,
        req.body.nombre,
        req.body.razon_social || req.body.nombre,
        req.body.rut || null,
        req.body.sector || 'seguridad',
        req.body.contacto || null,
        req.body.email || null,
        req.body.telefono || null,
        req.body.direccion || null,
        req.body.ciudad || null,
        req.body.color || '#0f766e',
        req.body.activo !== false,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Actualizar cliente. Solo operador.
router.put('/:id', authenticateToken, requireOperator, async (req, res) => {
  try {
    assertClienteAccess(req.user, req.params.id);
    const updates = [];
    const values = [];
    for (const field of CLIENT_FIELDS) {
      if (req.body[field] === undefined) continue;
      values.push(req.body[field]);
      updates.push(`${field} = $${values.length}`);
    }
    if (!updates.length) {
      return res.status(400).json({ error: 'No se enviaron campos para actualizar.' });
    }
    values.push(req.params.id);
    const empresaIndex = values.length + 1;
    values.push(req.user?.empresa_id || null);
    const result = await pool.query(
      `UPDATE clientes
       SET ${updates.join(', ')}, actualizado_en = NOW()
       WHERE id = $${values.length - 1}
         AND ($${empresaIndex}::uuid IS NULL OR empresa_id = $${empresaIndex})
       RETURNING *`,
      values
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Cliente no encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Sucursales de un cliente.
router.get('/:id/sucursales', authenticateToken, async (req, res) => {
  try {
    assertClienteAccess(req.user, req.params.id);
    const result = await pool.query(
      `SELECT * FROM sucursales
       WHERE cliente_id = $1
         AND ($2::uuid IS NULL OR empresa_id = $2)
       ORDER BY nombre`,
      [req.params.id, req.user?.empresa_id || null]
    );
    res.json(result.rows);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/sucursales', authenticateToken, requireOperator, async (req, res) => {
  try {
    assertClienteAccess(req.user, req.params.id);
    if (!req.body.nombre) {
      return res.status(400).json({ error: 'El nombre de la sucursal es requerido.' });
    }
    const client = await pool.query(
      `SELECT id, empresa_id FROM clientes
       WHERE id = $1 AND ($2::uuid IS NULL OR empresa_id = $2)`,
      [req.params.id, req.user?.empresa_id || null]
    );
    if (!client.rows.length) {
      throw httpError(404, 'Cliente no encontrado.');
    }
    const result = await pool.query(
      `INSERT INTO sucursales (empresa_id, cliente_id, nombre, direccion, ciudad)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [
        client.rows[0].empresa_id,
        client.rows[0].id,
        req.body.nombre,
        req.body.direccion || null,
        req.body.ciudad || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
