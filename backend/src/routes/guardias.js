const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { scopedClienteId, scopedEmpresaId, denyValidador } = require('../middleware/tenant');
const { MAX_FILAS_IMPORTACION, normalizarRut, validarTrabajador } = require('../utils/trabajadores');

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
router.post('/', authenticateToken, denyValidador, async (req, res) => {
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

/**
 * Carga masiva de trabajadores (Excel, CSV o una conexión con otra aplicación).
 *
 * Valida cada fila, omite los RUT repetidos (dentro de la carga o ya existentes en la empresa),
 * respeta el tope del plan y guarda todo en una sola transacción. Las filas con problemas no
 * impiden guardar las correctas: se devuelven con el motivo para que se puedan corregir.
 */
router.post('/importar', authenticateToken, denyValidador, async (req, res) => {
  let client;
  try {
    const empresaId = scopedEmpresaId(req.user, req.body.empresa_id);
    const clienteId = scopedClienteId(req.user, req.body.cliente_id);
    const filas = req.body.trabajadores;

    if (!empresaId) {
      return res.status(400).json({ error: 'empresa_id es requerido.' });
    }
    if (!Array.isArray(filas) || filas.length === 0) {
      return res.status(400).json({ error: 'Envía al menos un trabajador para importar.' });
    }
    if (filas.length > MAX_FILAS_IMPORTACION) {
      return res.status(400).json({
        error: `Cada carga admite hasta ${MAX_FILAS_IMPORTACION} trabajadores. Divide el archivo en partes.`,
      });
    }

    const invalidos = [];
    const omitidos = [];
    const candidatos = [];
    const vistos = new Map();

    filas.forEach((item, indice) => {
      // La primera fila de datos de una planilla con encabezado es la 2.
      const fila = Number.isInteger(item?.fila) ? item.fila : indice + 2;
      const resultado = validarTrabajador(item);
      const nombre = String(item?.nombre_completo ?? '').trim();
      const rutOriginal = String(item?.rut ?? '').trim();

      if (resultado.errores.length) {
        invalidos.push({ fila, nombre, rut: rutOriginal, errores: resultado.errores });
        return;
      }
      const previa = vistos.get(resultado.datos.rut);
      if (previa) {
        omitidos.push({
          fila,
          nombre: resultado.datos.nombre_completo,
          rut: resultado.datos.rut,
          motivo: `RUT repetido en el archivo (ya aparece en la fila ${previa}).`,
        });
        return;
      }
      vistos.set(resultado.datos.rut, fila);
      candidatos.push({ fila, ...resultado.datos });
    });

    let creados = 0;

    if (candidatos.length > 0) {
      client = await pool.connect();
      await client.query('BEGIN');
      // Serializa las cargas de una misma empresa para que dos cargas simultáneas no dupliquen RUT
      // ni superen el tope del plan.
      await client.query('SELECT id FROM empresas WHERE id = $1 FOR UPDATE', [empresaId]);

      const existentes = await client.query('SELECT rut FROM guardias WHERE empresa_id = $1', [empresaId]);
      const rutsExistentes = new Set(existentes.rows.map((row) => normalizarRut(row.rut)));

      const nuevos = [];
      for (const candidato of candidatos) {
        if (rutsExistentes.has(candidato.rut)) {
          omitidos.push({
            fila: candidato.fila,
            nombre: candidato.nombre_completo,
            rut: candidato.rut,
            motivo: 'Ya existe un trabajador con ese RUT.',
          });
        } else {
          nuevos.push(candidato);
        }
      }

      const limite = await client.query(
        `SELECT p.max_guardias
         FROM empresas e
         LEFT JOIN planes p ON p.id = e.plan_id
         WHERE e.id = $1`,
        [empresaId]
      );
      const planLimit = limite.rows[0]?.max_guardias;
      if (planLimit !== null && planLimit !== undefined && existentes.rowCount + nuevos.length > planLimit) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          error:
            `Tu plan permite hasta ${planLimit} trabajadores y ya tienes ${existentes.rowCount}. ` +
            `Esta carga agregaría ${nuevos.length}. Amplía el plan o carga menos trabajadores.`,
          code: 'PLAN_LIMIT',
        });
      }

      if (nuevos.length > 0) {
        await client.query(
          `INSERT INTO guardias
             (empresa_id, cliente_id, nombre_completo, rut, email, telefono,
              fecha_contrato, horas_semanales_max, cargo, activo)
           SELECT $1::uuid, $2::uuid, t.nombre, t.rut, t.email, t.telefono,
                  t.fecha, t.horas, t.cargo, t.activo
           FROM unnest($3::text[], $4::text[], $5::text[], $6::text[], $7::date[],
                       $8::int[], $9::text[], $10::boolean[])
                AS t(nombre, rut, email, telefono, fecha, horas, cargo, activo)`,
          [
            empresaId,
            clienteId,
            nuevos.map((n) => n.nombre_completo),
            nuevos.map((n) => n.rut),
            nuevos.map((n) => n.email),
            nuevos.map((n) => n.telefono),
            nuevos.map((n) => n.fecha_contrato),
            nuevos.map((n) => n.horas_semanales_max),
            nuevos.map((n) => n.cargo),
            nuevos.map((n) => n.activo),
          ]
        );
      }
      await client.query('COMMIT');
      creados = nuevos.length;
    }

    omitidos.sort((a, b) => a.fila - b.fila);
    invalidos.sort((a, b) => a.fila - b.fila);
    res.status(creados > 0 ? 201 : 200).json({ creados, omitidos, invalidos });
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        // La conexión ya estaba cerrada o sin transacción abierta.
      }
    }
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    if (client) client.release();
  }
});

// Registrar certificación OS-10.
router.post('/:id/certificacion-os10', authenticateToken, denyValidador, async (req, res) => {
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
router.delete('/:id', authenticateToken, denyValidador, async (req, res) => {
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
router.put('/:id', authenticateToken, denyValidador, async (req, res) => {
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
