const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { scopedClienteId, scopedEmpresaId } = require('../middleware/tenant');

async function findGuard(id, user, { empresaId = null, clienteId = null } = {}) {
  const scopedEmpresa = scopedEmpresaId(user, empresaId);
  const scopedCliente = scopedClienteId(user, clienteId);
  const result = await pool.query(
    `SELECT * FROM guardias
     WHERE id = $1
       AND ($2::uuid IS NULL OR empresa_id = $2)
       AND ($3::uuid IS NULL OR cliente_id = $3)`,
    [id, scopedEmpresa, scopedCliente]
  );
  return result.rows[0] || null;
}

// Listar guardias visibles para la cuenta.
router.get('/', authenticateToken, async (req, res) => {
  try {
    const clienteId = scopedClienteId(req.user, req.query.cliente_id);
    const empresaId = scopedEmpresaId(req.user, req.query.empresa_id);
    const result = await pool.query(
      `SELECT g.*, c.numero_certificado, c.fecha_vencimiento, c.emitido_por,
              cl.nombre AS cliente_nombre
       FROM guardias g
       LEFT JOIN LATERAL (
         SELECT numero_certificado, fecha_vencimiento, emitido_por
         FROM certificaciones_os10
         WHERE guardia_id = g.id
         ORDER BY fecha_vencimiento DESC
         LIMIT 1
       ) c ON true
       LEFT JOIN clientes cl ON cl.id = g.cliente_id
       WHERE ($1::uuid IS NULL OR g.empresa_id = $1)
         AND ($2::uuid IS NULL OR g.cliente_id = $2)
       ORDER BY g.nombre_completo`,
      [empresaId, clienteId]
    );
    res.json(result.rows);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear guardia. Un usuario cliente solo puede crear guardias de su cliente.
router.post('/', authenticateToken, async (req, res) => {
  try {
    const empresaId = scopedEmpresaId(req.user, req.body.empresa_id);
    const clienteId = scopedClienteId(req.user, req.body.cliente_id);
    const {
      nombre_completo,
      rut,
      email,
      telefono,
      fecha_contrato,
      horas_semanales_max,
      cargo,
    } = req.body;

    if (!empresaId || !nombre_completo || !rut) {
      return res.status(400).json({ error: 'empresa_id, nombre_completo y rut son requeridos.' });
    }

    const limitResult = await pool.query(
      `SELECT p.max_guardias
       FROM empresas e
       LEFT JOIN planes p ON p.id = e.plan_id
       WHERE e.id = $1`,
      [empresaId]
    );
    const planLimit = limitResult.rows[0]?.max_guardias;
    if (planLimit !== null && planLimit !== undefined) {
      const countResult = await pool.query(
        'SELECT count(*)::int AS total FROM guardias WHERE empresa_id = $1',
        [empresaId]
      );
      if (countResult.rows[0].total >= planLimit) {
        return res.status(403).json({
          error: `Tu plan permite hasta ${planLimit} guardias. Amplía el plan para agregar más.`,
          code: 'PLAN_LIMIT',
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO guardias
         (empresa_id, cliente_id, nombre_completo, rut, email, telefono,
          fecha_contrato, horas_semanales_max, cargo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        empresaId,
        clienteId,
        nombre_completo,
        rut,
        email || null,
        telefono || null,
        fecha_contrato || null,
        horas_semanales_max || null,
        cargo || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Registrar certificación OS-10.
router.post('/:id/certificacion-os10', authenticateToken, async (req, res) => {
  try {
    const guard = await findGuard(req.params.id, req.user, {
      empresaId: req.body.empresa_id,
      clienteId: req.body.cliente_id,
    });
    if (!guard) {
      return res.status(404).json({ error: 'Guardia no encontrado.' });
    }

    const { numero_certificado, fecha_vencimiento } = req.body;
    await pool.query('DELETE FROM certificaciones_os10 WHERE guardia_id = $1', [guard.id]);

    const result = await pool.query(
      `INSERT INTO certificaciones_os10 (guardia_id, numero_certificado, fecha_vencimiento)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [guard.id, numero_certificado, fecha_vencimiento]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar un trabajador de la base de la empresa.
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const guard = await findGuard(req.params.id, req.user);
    if (!guard) {
      return res.status(404).json({ error: 'Trabajador no encontrado.' });
    }
    await pool.query('DELETE FROM guardias WHERE id = $1', [guard.id]);
    res.json({ deleted: true });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'No se pudo eliminar el trabajador.' });
  }
});

// Actualizar guardia.
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const guard = await findGuard(req.params.id, req.user, {
      empresaId: req.body.empresa_id,
      clienteId: req.body.cliente_id,
    });
    if (!guard) {
      return res.status(404).json({ error: 'Guardia no encontrado.' });
    }

    const {
      nombre_completo,
      rut,
      email,
      telefono,
      fecha_contrato,
      horas_semanales_max,
      cargo,
      activo,
    } = req.body;

    const result = await pool.query(
      `UPDATE guardias
       SET nombre_completo = $1, rut = $2, email = $3, telefono = $4,
           fecha_contrato = $5, horas_semanales_max = $6, cargo = $7,
           activo = $8, actualizado_en = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        nombre_completo,
        rut,
        email,
        telefono,
        fecha_contrato,
        horas_semanales_max,
        cargo,
        activo,
        guard.id,
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
