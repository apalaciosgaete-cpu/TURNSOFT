const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken, clearEmpresaStatusCache } = require('../middleware/auth');
const { requireSuperadmin } = require('../middleware/tenant');

const SECTORES = new Set(['seguridad', 'salud', 'mineria', 'retail', 'logistica']);
const ESTADOS_EMPRESA = new Set(['prueba', 'activa', 'suspendida', 'vencida']);
const ESTADOS_PAGO = new Set(['pendiente', 'pagado', 'vencido', 'anulado']);
const METODOS_PAGO = new Set(['transferencia', 'tarjeta', 'efectivo', 'otro']);
const CATEGORIAS_SOPORTE = new Set(['consulta', 'pago', 'tecnico', 'otro']);
const PRIORIDADES_SOPORTE = new Set(['baja', 'normal', 'alta', 'urgente']);
const ESTADOS_SOPORTE = new Set(['abierto', 'en_revision', 'resuelto', 'cerrado']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function clean(value, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

function parseMoney(value, field = 'monto') {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw httpError(400, `El ${field} debe ser un entero mayor o igual a 0.`);
  }
  return number;
}

function parseLimit(value, field) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw httpError(400, `${field} debe ser un entero mayor o igual a 0, o quedar vacío para ilimitado.`);
  }
  return number;
}

/**
 * Cierra las pruebas que ya cumplieron sus 15 días. Se ejecuta antes de leer
 * los resúmenes para que el supervisor vea el estado real sin esperar a que
 * la empresa intente iniciar sesión.
 */
async function expireTrials() {
  const result = await pool.query(`
    UPDATE empresas
    SET estado = 'vencida', actualizado_en = NOW()
    WHERE estado = 'prueba' AND prueba_fin IS NOT NULL AND prueba_fin < NOW()
    RETURNING id
  `);
  if (result.rowCount) clearEmpresaStatusCache();
}

function handleError(res, error, context) {
  if (error.status) return res.status(error.status).json({ error: error.message });
  if (error.code === '22P02') return res.status(400).json({ error: 'Identificador inválido.' });
  if (error.code === '23503') return res.status(400).json({ error: 'La referencia indicada no existe.' });
  if (error.code === '23505') {
    if (error.constraint === 'empresas_rut_empresa_key') {
      return res.status(409).json({ error: 'Ya existe una empresa con ese RUT.' });
    }
    if (error.constraint === 'usuarios_email_key') {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
    }
    if (error.constraint === 'planes_nombre_key') {
      return res.status(409).json({ error: 'Ya existe un plan con ese nombre.' });
    }
    return res.status(409).json({ error: 'Ya existe un registro con esos datos.' });
  }
  if (error.code === '42P01') {
    return res.status(503).json({ error: 'El esquema de la base de datos aún no está migrado.' });
  }
  console.error(`[master/${context}]`, error);
  return res.status(500).json({ error: 'No se pudo completar la operación.' });
}

router.use(authenticateToken, requireSuperadmin);

/**
 * Resumen global de ocupación de la plataforma. El supervisor no da de alta
 * empresas: aquí solo observa lo que ya está operando y lo que requiere acción.
 */
router.get('/resumen', async (req, res) => {
  try {
    await expireTrials();
    const [stats, atencion, pagos, tickets, recientes] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT count(*)::int FROM empresas) AS empresas,
          (SELECT count(*)::int FROM empresas WHERE estado = 'activa') AS activas,
          (SELECT count(*)::int FROM empresas
            WHERE estado = 'prueba' AND (prueba_fin IS NULL OR prueba_fin >= NOW())) AS en_prueba,
          (SELECT count(*)::int FROM empresas
            WHERE (estado = 'prueba' AND prueba_fin IS NOT NULL AND prueba_fin < NOW())
               OR estado = 'vencida') AS pruebas_vencidas,
          (SELECT count(*)::int FROM empresas
            WHERE estado = 'prueba' AND prueba_fin >= NOW()
              AND prueba_fin <= NOW() + INTERVAL '5 days') AS pruebas_por_vencer,
          (SELECT count(*)::int FROM empresas WHERE estado = 'suspendida') AS suspendidas,
          (SELECT count(*)::int FROM empresas
            WHERE creado_en >= date_trunc('month', NOW())) AS nuevas_mes,
          (SELECT count(*)::int FROM clientes) AS clientes,
          (SELECT count(*)::int FROM guardias) AS guardias,
          (SELECT count(*)::int FROM usuarios) AS usuarios,
          (SELECT count(*)::int FROM usuarios WHERE rol IN ('operador', 'admin')) AS operadores,
          (SELECT count(*)::int FROM planes WHERE activo = true) AS planes_activos,
          (SELECT count(*)::int FROM pagos WHERE estado = 'pendiente') AS pagos_pendientes,
          (SELECT count(*)::int FROM pagos WHERE estado = 'vencido') AS pagos_vencidos,
          (SELECT coalesce(sum(monto), 0)::int FROM pagos WHERE estado = 'vencido') AS monto_vencido,
          (SELECT coalesce(sum(monto), 0)::int FROM pagos
            WHERE estado = 'pagado' AND periodo = to_char(now(), 'YYYY-MM')) AS ingresos_mes,
          (SELECT coalesce(sum(p.precio_mensual), 0)::int
            FROM empresas e JOIN planes p ON p.id = e.plan_id
            WHERE e.estado = 'activa') AS mrr,
          (SELECT coalesce(sum(p.max_guardias), 0)::int
            FROM empresas e JOIN planes p ON p.id = e.plan_id
            WHERE e.estado IN ('activa', 'prueba') AND p.max_guardias IS NOT NULL) AS capacidad_guardias,
          (SELECT count(*)::int FROM soporte_tickets
            WHERE estado IN ('abierto', 'en_revision')) AS tickets_abiertos
      `),
      pool.query(`
        SELECT e.id, e.razon_social, e.estado, e.motivo_bloqueo, e.prueba_fin,
               GREATEST(0, ceil(extract(epoch FROM (e.prueba_fin - NOW())) / 86400))::int AS dias_prueba,
               p.nombre AS plan_nombre,
               lp.periodo AS ultimo_periodo,
               lp.estado AS ultimo_pago_estado,
               lp.monto AS ultimo_pago_monto
        FROM empresas e
        LEFT JOIN planes p ON p.id = e.plan_id
        LEFT JOIN LATERAL (
          SELECT periodo, estado, monto
          FROM pagos
          WHERE empresa_id = e.id
          ORDER BY periodo DESC, creado_en DESC
          LIMIT 1
        ) lp ON true
        WHERE e.estado IN ('suspendida', 'vencida')
           OR (e.estado = 'prueba' AND e.prueba_fin IS NOT NULL
               AND e.prueba_fin <= NOW() + INTERVAL '5 days')
           OR lp.estado = 'vencido'
        ORDER BY CASE
                   WHEN e.estado = 'vencida' THEN 0
                   WHEN e.estado = 'suspendida' THEN 1
                   WHEN e.estado = 'prueba' THEN 2
                   ELSE 3
                 END,
                 e.prueba_fin NULLS LAST,
                 e.razon_social
        LIMIT 6
      `),
      pool.query(`
        SELECT pg.id, pg.periodo, pg.monto, pg.estado, pg.fecha_vencimiento,
               e.id AS empresa_id, e.razon_social
        FROM pagos pg
        JOIN empresas e ON e.id = pg.empresa_id
        WHERE pg.estado IN ('pendiente', 'vencido')
        ORDER BY CASE pg.estado WHEN 'vencido' THEN 0 ELSE 1 END,
                 pg.fecha_vencimiento NULLS LAST, pg.periodo
        LIMIT 6
      `),
      pool.query(`
        SELECT t.id, t.asunto, t.prioridad, t.estado, t.creado_en,
               e.id AS empresa_id, e.razon_social
        FROM soporte_tickets t
        JOIN empresas e ON e.id = t.empresa_id
        WHERE t.estado IN ('abierto', 'en_revision')
        ORDER BY CASE t.prioridad
                   WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 WHEN 'normal' THEN 2 ELSE 3
                 END,
                 t.creado_en DESC
        LIMIT 6
      `),
      pool.query(`
        SELECT e.id, e.razon_social, e.rut_empresa, e.sector, e.estado, e.origen,
               e.prueba_fin, e.creado_en,
               GREATEST(0, ceil(extract(epoch FROM (e.prueba_fin - NOW())) / 86400))::int AS dias_prueba,
               p.nombre AS plan_nombre,
               (SELECT count(*)::int FROM clientes c WHERE c.empresa_id = e.id) AS clientes,
               (SELECT count(*)::int FROM guardias g WHERE g.empresa_id = e.id) AS guardias
        FROM empresas e
        LEFT JOIN planes p ON p.id = e.plan_id
        ORDER BY e.creado_en DESC
        LIMIT 6
      `),
    ]);

    res.json({
      ...stats.rows[0],
      empresas_atencion: atencion.rows,
      pagos_por_verificar: pagos.rows,
      tickets_recientes: tickets.rows,
      empresas_recientes: recientes.rows,
    });
  } catch (error) {
    handleError(res, error, 'resumen');
  }
});

/**
 * Listado global de empresas con plan, uso y último pago.
 */
router.get('/empresas', async (req, res) => {
  try {
    await expireTrials();
    const result = await pool.query(`
      SELECT e.id, e.razon_social, e.rut_empresa, e.sector, e.estado, e.dia_cobro,
             e.bloqueada_en, e.motivo_bloqueo, e.notas, e.creado_en, e.origen,
             e.email_contacto, e.telefono, e.direccion, e.ciudad,
             e.prueba_inicio, e.prueba_fin, e.activada_en,
             CASE
               WHEN e.estado = 'prueba' AND e.prueba_fin >= NOW()
                 THEN GREATEST(0, ceil(extract(epoch FROM (e.prueba_fin - NOW())) / 86400))::int
               ELSE 0
             END AS dias_prueba,
             p.id AS plan_id, p.nombre AS plan_nombre, p.precio_mensual,
             p.max_clientes, p.max_usuarios, p.max_guardias,
             (SELECT count(*)::int FROM clientes c WHERE c.empresa_id = e.id) AS clientes,
             (SELECT count(*)::int FROM usuarios u
               WHERE u.empresa_id = e.id AND u.rol IN ('operador', 'admin')) AS operadores,
             (SELECT count(*)::int FROM guardias g WHERE g.empresa_id = e.id) AS guardias,
             (SELECT count(*)::int FROM soporte_tickets st
               WHERE st.empresa_id = e.id AND st.estado IN ('abierto', 'en_revision')) AS tickets_abiertos,
             adm.admin AS administrador,
             lp.pago AS ultimo_pago
      FROM empresas e
      LEFT JOIN planes p ON p.id = e.plan_id
      LEFT JOIN LATERAL (
        SELECT json_build_object(
          'id', u.id, 'nombre', u.nombre, 'email', u.email
        ) AS admin
        FROM usuarios u
        WHERE u.empresa_id = e.id AND u.rol IN ('operador', 'admin')
        ORDER BY u.creado_en ASC
        LIMIT 1
      ) adm ON true
      LEFT JOIN LATERAL (
        SELECT json_build_object(
          'id', pg.id, 'periodo', pg.periodo, 'estado', pg.estado,
          'monto', pg.monto, 'fecha_vencimiento', pg.fecha_vencimiento,
          'fecha_pago', pg.fecha_pago
        ) AS pago
        FROM pagos pg
        WHERE pg.empresa_id = e.id
        ORDER BY pg.periodo DESC, pg.creado_en DESC
        LIMIT 1
      ) lp ON true
      ORDER BY CASE e.estado WHEN 'suspendida' THEN 0 ELSE 1 END, e.razon_social
    `);
    res.json(result.rows);
  } catch (error) {
    handleError(res, error, 'empresas-list');
  }
});

/**
 * Cambiar plan, día de cobro o estado (bloquear / reactivar) de una empresa.
 * El alta de empresas es pública: el supervisor no crea cuentas desde aquí.
 */
router.patch('/empresas/:id', async (req, res) => {
  const { id } = req.params;
  const sets = [];
  const values = [];

  try {
    const current = await pool.query('SELECT id, estado FROM empresas WHERE id = $1', [id]);
    if (!current.rows.length) return res.status(404).json({ error: 'Empresa no encontrada.' });

    if (req.body?.plan_id !== undefined) {
      const planId = clean(req.body.plan_id, 36) || null;
      if (planId) {
        const plan = await pool.query('SELECT id FROM planes WHERE id = $1', [planId]);
        if (!plan.rows.length) return res.status(400).json({ error: 'El plan seleccionado no existe.' });
      }
      values.push(planId);
      sets.push(`plan_id = $${values.length}`);
    }

    if (req.body?.dia_cobro !== undefined) {
      const dia = Number(req.body.dia_cobro);
      if (!Number.isInteger(dia) || dia < 1 || dia > 28) {
        return res.status(400).json({ error: 'El día de cobro debe estar entre 1 y 28.' });
      }
      values.push(dia);
      sets.push(`dia_cobro = $${values.length}`);
    }

    if (req.body?.notas !== undefined) {
      values.push(clean(req.body.notas, 2000) || null);
      sets.push(`notas = $${values.length}`);
    }

    if (req.body?.estado !== undefined) {
      const estado = clean(req.body.estado, 20);
      if (!ESTADOS_EMPRESA.has(estado)) {
        return res.status(400).json({ error: 'El estado debe ser prueba, activa, suspendida o vencida.' });
      }
      values.push(estado);
      sets.push(`estado = $${values.length}`);

      if (estado === 'suspendida') {
        values.push(clean(req.body.motivo_bloqueo, 500) || 'Falta de pago');
        sets.push(`motivo_bloqueo = $${values.length}`);
        values.push(req.user.id);
        sets.push(`bloqueada_por = $${values.length}`);
        sets.push('bloqueada_en = NOW()');
      } else {
        sets.push('motivo_bloqueo = NULL');
        sets.push('bloqueada_por = NULL');
        sets.push('bloqueada_en = NULL');
        if (estado === 'activa') sets.push('activada_en = NOW()');
      }
    }

    if (!sets.length) {
      return res.status(400).json({ error: 'No se enviaron cambios para la empresa.' });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE empresas
       SET ${sets.join(', ')}, actualizado_en = NOW()
       WHERE id = $${values.length}
       RETURNING id, razon_social, rut_empresa, sector, estado, plan_id,
                 dia_cobro, bloqueada_en, motivo_bloqueo, creado_en, actualizado_en`,
      values
    );

    clearEmpresaStatusCache(id);
    return res.json(result.rows[0]);
  } catch (error) {
    handleError(res, error, 'empresas-patch');
  }
});

/**
 * Planes de pago.
 */
router.get('/planes', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*,
             (SELECT count(*)::int FROM empresas e WHERE e.plan_id = p.id) AS empresas
      FROM planes p
      ORDER BY p.activo DESC, p.precio_mensual, p.nombre
    `);
    res.json(result.rows);
  } catch (error) {
    handleError(res, error, 'planes-list');
  }
});

function parsePlanBody(body, { partial = false } = {}) {
  const data = {};
  if (!partial || body.nombre !== undefined) {
    data.nombre = clean(body.nombre, 80);
    if (!data.nombre) throw httpError(400, 'Ingresa el nombre del plan.');
  }
  if (!partial || body.descripcion !== undefined) {
    data.descripcion = clean(body.descripcion, 1000) || null;
  }
  if (!partial || body.precio_mensual !== undefined) {
    const price = parseMoney(body.precio_mensual, 'precio mensual');
    data.precio_mensual = price === null ? 0 : price;
  }
  if (!partial || body.max_clientes !== undefined) {
    data.max_clientes = parseLimit(body.max_clientes, 'El máximo de clientes');
  }
  if (!partial || body.max_usuarios !== undefined) {
    data.max_usuarios = parseLimit(body.max_usuarios, 'El máximo de usuarios');
  }
  if (!partial || body.max_guardias !== undefined) {
    data.max_guardias = parseLimit(body.max_guardias, 'El máximo de guardias');
  }
  if (!partial || body.activo !== undefined) {
    data.activo = body.activo !== false;
  }
  return data;
}

router.post('/planes', async (req, res) => {
  try {
    const data = parsePlanBody(req.body || {});
    const result = await pool.query(
      `INSERT INTO planes
         (nombre, descripcion, precio_mensual, max_clientes, max_usuarios, max_guardias, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.nombre,
        data.descripcion,
        data.precio_mensual,
        data.max_clientes,
        data.max_usuarios,
        data.max_guardias,
        data.activo,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    handleError(res, error, 'planes-create');
  }
});

router.patch('/planes/:id', async (req, res) => {
  try {
    const data = parsePlanBody(req.body || {}, { partial: true });
    const fields = Object.keys(data);
    if (!fields.length) return res.status(400).json({ error: 'No se enviaron cambios para el plan.' });

    const values = fields.map((field) => data[field]);
    const sets = fields.map((field, index) => `${field} = $${index + 1}`);
    values.push(req.params.id);

    const result = await pool.query(
      `UPDATE planes
       SET ${sets.join(', ')}, actualizado_en = NOW()
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Plan no encontrado.' });
    res.json(result.rows[0]);
  } catch (error) {
    handleError(res, error, 'planes-patch');
  }
});

/**
 * Pagos: registro y verificación manual.
 */
router.get('/pagos', async (req, res) => {
  try {
    await expireTrials();
    const estado = clean(req.query.estado, 20) || null;
    const empresaId = clean(req.query.empresa_id, 36) || null;
    const result = await pool.query(
      `SELECT pg.*, e.razon_social, e.estado AS empresa_estado,
              p.nombre AS plan_nombre
       FROM pagos pg
       JOIN empresas e ON e.id = pg.empresa_id
       LEFT JOIN planes p ON p.id = pg.plan_id
       WHERE ($1::text IS NULL OR pg.estado = $1)
         AND ($2::uuid IS NULL OR pg.empresa_id = $2)
       ORDER BY CASE pg.estado
                  WHEN 'vencido' THEN 0 WHEN 'pendiente' THEN 1 ELSE 2
                END,
                pg.periodo DESC, pg.creado_en DESC`,
      [estado, empresaId]
    );
    res.json(result.rows);
  } catch (error) {
    handleError(res, error, 'pagos-list');
  }
});

router.post('/pagos', async (req, res) => {
  try {
    const empresaId = clean(req.body?.empresa_id, 36);
    const periodo = clean(req.body?.periodo, 7);
    const metodo = clean(req.body?.metodo, 30) || null;
    const referencia = clean(req.body?.referencia, 120) || null;
    const notas = clean(req.body?.notas, 2000) || null;
    const fechaVencimiento = clean(req.body?.fecha_vencimiento, 10) || null;
    const planIdBody = clean(req.body?.plan_id, 36) || null;

    if (!empresaId) return res.status(400).json({ error: 'Selecciona la empresa.' });
    if (!PERIODO_RE.test(periodo)) {
      return res.status(400).json({ error: 'El período debe tener el formato AAAA-MM.' });
    }
    if (metodo && !METODOS_PAGO.has(metodo)) {
      return res.status(400).json({ error: 'El método de pago no es válido.' });
    }
    if (fechaVencimiento && !FECHA_RE.test(fechaVencimiento)) {
      return res.status(400).json({ error: 'La fecha de vencimiento debe tener el formato AAAA-MM-DD.' });
    }

    const empresaResult = await pool.query(
      'SELECT id, razon_social, plan_id, dia_cobro FROM empresas WHERE id = $1',
      [empresaId]
    );
    if (!empresaResult.rows.length) return res.status(404).json({ error: 'Empresa no encontrada.' });
    const empresa = empresaResult.rows[0];

    const planId = planIdBody || empresa.plan_id || null;
    let monto = parseMoney(req.body?.monto, 'monto');
    if (monto === null && planId) {
      const plan = await pool.query('SELECT precio_mensual FROM planes WHERE id = $1', [planId]);
      monto = plan.rows[0]?.precio_mensual ?? 0;
    }
    if (monto === null) monto = 0;

    const dueDate = fechaVencimiento || `${periodo}-${String(empresa.dia_cobro || 1).padStart(2, '0')}`;

    const result = await pool.query(
      `INSERT INTO pagos
         (empresa_id, plan_id, periodo, monto, estado, metodo, referencia,
          fecha_vencimiento, notas)
       VALUES ($1, $2, $3, $4, 'pendiente', $5, $6, $7, $8)
       RETURNING *`,
      [empresaId, planId, periodo, monto, metodo, referencia, dueDate, notas]
    );

    res.status(201).json({ ...result.rows[0], razon_social: empresa.razon_social });
  } catch (error) {
    handleError(res, error, 'pagos-create');
  }
});

router.patch('/pagos/:id', async (req, res) => {
  const sets = [];
  const values = [];

  try {
    const current = await pool.query(
      `SELECT pg.*, e.razon_social, e.estado AS empresa_estado
       FROM pagos pg JOIN empresas e ON e.id = pg.empresa_id
       WHERE pg.id = $1`,
      [req.params.id]
    );
    if (!current.rows.length) return res.status(404).json({ error: 'Pago no encontrado.' });
    const pago = current.rows[0];

    if (req.body?.estado !== undefined) {
      const estado = clean(req.body.estado, 20);
      if (!ESTADOS_PAGO.has(estado)) {
        return res.status(400).json({ error: 'El estado del pago no es válido.' });
      }
      values.push(estado);
      sets.push(`estado = $${values.length}`);
      if (estado === 'pagado') {
        values.push(req.user.id);
        sets.push(`verificado_por = $${values.length}`);
        if (pago.estado !== 'pagado') sets.push('fecha_pago = NOW()');
      } else {
        sets.push('fecha_pago = NULL');
        sets.push('verificado_por = NULL');
      }
    }

    if (req.body?.metodo !== undefined) {
      const metodo = clean(req.body.metodo, 30) || null;
      if (metodo && !METODOS_PAGO.has(metodo)) {
        return res.status(400).json({ error: 'El método de pago no es válido.' });
      }
      values.push(metodo);
      sets.push(`metodo = $${values.length}`);
    }

    if (req.body?.referencia !== undefined) {
      values.push(clean(req.body.referencia, 120) || null);
      sets.push(`referencia = $${values.length}`);
    }

    if (req.body?.notas !== undefined) {
      values.push(clean(req.body.notas, 2000) || null);
      sets.push(`notas = $${values.length}`);
    }

    if (!sets.length) {
      return res.status(400).json({ error: 'No se enviaron cambios para el pago.' });
    }

    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE pagos
       SET ${sets.join(', ')}, actualizado_en = NOW()
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );

    let empresa = null;
    if (req.body?.estado === 'pagado' && req.body?.reactivar !== false) {
      const updated = await pool.query(
        `UPDATE empresas
         SET estado = 'activa', motivo_bloqueo = NULL, bloqueada_por = NULL,
             bloqueada_en = NULL, activada_en = NOW(), actualizado_en = NOW()
         WHERE id = $1
         RETURNING id, razon_social, estado`,
        [pago.empresa_id]
      );
      empresa = updated.rows[0] || null;
      clearEmpresaStatusCache(pago.empresa_id);
    }

    res.json({
      ...result.rows[0],
      razon_social: pago.razon_social,
      empresa_estado: empresa?.estado || pago.empresa_estado,
      empresa_reactivada: Boolean(empresa),
    });
  } catch (error) {
    handleError(res, error, 'pagos-patch');
  }
});

/**
 * Soporte: bandeja global y respuesta del supervisor.
 */
router.get('/soporte', async (req, res) => {
  try {
    const estado = clean(req.query.estado, 20) || null;
    const empresaId = clean(req.query.empresa_id, 36) || null;
    const result = await pool.query(
      `SELECT t.*, e.razon_social, e.estado AS empresa_estado,
              u.nombre AS usuario_nombre, u.email AS usuario_email
       FROM soporte_tickets t
       JOIN empresas e ON e.id = t.empresa_id
       LEFT JOIN usuarios u ON u.id = t.usuario_id
       WHERE ($1::text IS NULL OR t.estado = $1)
         AND ($2::uuid IS NULL OR t.empresa_id = $2)
       ORDER BY CASE t.estado
                  WHEN 'abierto' THEN 0 WHEN 'en_revision' THEN 1
                  WHEN 'resuelto' THEN 2 ELSE 3
                END,
                CASE t.prioridad
                  WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 WHEN 'normal' THEN 2 ELSE 3
                END,
                t.creado_en DESC`,
      [estado, empresaId]
    );
    res.json(result.rows);
  } catch (error) {
    handleError(res, error, 'soporte-list');
  }
});

router.patch('/soporte/:id', async (req, res) => {
  const sets = [];
  const values = [];

  try {
    const current = await pool.query('SELECT * FROM soporte_tickets WHERE id = $1', [req.params.id]);
    if (!current.rows.length) return res.status(404).json({ error: 'Ticket no encontrado.' });

    if (req.body?.prioridad !== undefined) {
      const prioridad = clean(req.body.prioridad, 20);
      if (!PRIORIDADES_SOPORTE.has(prioridad)) {
        return res.status(400).json({ error: 'La prioridad no es válida.' });
      }
      values.push(prioridad);
      sets.push(`prioridad = $${values.length}`);
    }

    const respuesta = clean(req.body?.respuesta, 5000);
    if (respuesta) {
      values.push(respuesta);
      sets.push(`respuesta = $${values.length}`);
      values.push(req.user.id);
      sets.push(`respondido_por = $${values.length}`);
      sets.push('respondido_en = NOW()');
      sets.push('visto_cliente = false');
    }

    const estadoBody = clean(req.body?.estado, 20);
    if (estadoBody) {
      if (!ESTADOS_SOPORTE.has(estadoBody)) {
        return res.status(400).json({ error: 'El estado del ticket no es válido.' });
      }
      values.push(estadoBody);
      sets.push(`estado = $${values.length}`);
    } else if (respuesta) {
      values.push('resuelto');
      sets.push(`estado = $${values.length}`);
    }

    if (!sets.length) {
      return res.status(400).json({ error: 'No se enviaron cambios para el ticket.' });
    }

    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE soporte_tickets
       SET ${sets.join(', ')}, actualizado_en = NOW()
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );
    res.json(result.rows[0]);
  } catch (error) {
    handleError(res, error, 'soporte-patch');
  }
});

module.exports = router;
