const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { getJwtSecret, JWT_ALGORITHM } = require('../config/jwt');
const { TRATAMIENTO_DATOS_VERSION } = require('../config/datos');

const ESTADO_CACHE_TTL = 30000;
const estadoCache = new Map();

function empresaAccess(empresa) {
  if (!empresa) {
    return {
      allowed: false,
      code: 'EMPRESA_INACTIVA',
      error: 'La empresa asociada a tu cuenta ya no está disponible.',
    };
  }

  if (empresa.estado === 'activa') return { allowed: true };

  if (empresa.estado === 'prueba') {
    const fin = empresa.prueba_fin ? new Date(empresa.prueba_fin).getTime() : 0;
    if (fin > Date.now()) return { allowed: true };
    return {
      allowed: false,
      code: 'PRUEBA_VENCIDA',
      error: 'Tu período de prueba de 15 días terminó. Activa un plan para seguir operando.',
    };
  }

  if (empresa.estado === 'vencida') {
    return {
      allowed: false,
      code: 'PRUEBA_VENCIDA',
      error: 'Tu período de prueba de 15 días terminó. Activa un plan para seguir operando.',
    };
  }

  return {
    allowed: false,
    code: 'EMPRESA_SUSPENDIDA',
    error: 'La cuenta de tu empresa está suspendida por falta de pago. Contacta a TURNSOFT para regularizar la situación.',
  };
}

async function getEmpresaEstado(empresaId) {
  const key = String(empresaId);
  const cached = estadoCache.get(key);
  if (cached && Date.now() - cached.at < ESTADO_CACHE_TTL) {
    return cached.empresa;
  }

  const result = await pool.query(
    'SELECT id, razon_social, estado, prueba_inicio, prueba_fin FROM empresas WHERE id = $1',
    [empresaId]
  );
  const empresa = result.rows[0] || null;
  estadoCache.set(key, { empresa, at: Date.now() });
  return empresa;
}

const usuarioCache = new Map();

/** Cuentas internas de una empresa: el gerente de la empresa, administradores y validadores. */
function requiereTratamientoDatos(usuario) {
  return Boolean(usuario?.empresa_id) && ['operador', 'admin', 'validador'].includes(usuario.rol);
}

/**
 * Estado vigente de la cuenta. El rol y el alcance se leen de la base (no del
 * token) para que un cambio de rol o una desactivación apliquen de inmediato.
 */
async function usuarioVigente(userId) {
  const key = String(userId);
  const cached = usuarioCache.get(key);
  if (cached && Date.now() - cached.at < ESTADO_CACHE_TTL) return cached.usuario;
  const result = await pool.query(
    `SELECT u.activo, u.rol, u.empresa_id, u.cliente_id, u.debe_cambiar_clave,
            EXISTS (
              SELECT 1 FROM aceptaciones_datos a
              WHERE a.empresa_id = u.empresa_id AND a.version = $2
            ) AS datos_aceptados
     FROM usuarios u WHERE u.id = $1`,
    [userId, TRATAMIENTO_DATOS_VERSION]
  );
  const usuario = result.rows[0] || null;
  usuarioCache.set(key, { usuario, at: Date.now() });
  return usuario;
}

function clearUsuarioCache(userId) {
  if (userId) usuarioCache.delete(String(userId));
  else usuarioCache.clear();
}

function clearEmpresaStatusCache(empresaId) {
  if (empresaId) {
    estadoCache.delete(String(empresaId));
    return;
  }
  estadoCache.clear();
}

async function expireTrialIfNeeded(empresa) {
  if (!empresa || empresa.estado !== 'prueba') return empresa;
  const access = empresaAccess(empresa);
  if (access.allowed) return empresa;

  await pool
    .query(
      `UPDATE empresas
       SET estado = 'vencida', actualizado_en = NOW()
       WHERE id = $1 AND estado = 'prueba'`,
      [empresa.id]
    )
    .catch((error) => console.error('[auth/expirar-prueba]', error.message));

  clearEmpresaStatusCache(empresa.id);
  return { ...empresa, estado: 'vencida' };
}

function makeAuthenticator({ allowPending }) {
  return (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token de acceso requerido' });
    }

    jwt.verify(token, getJwtSecret(), { algorithms: [JWT_ALGORITHM] }, async (err, payload) => {
      if (err) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
      }

      let user = payload;
      try {
        const vigente = await usuarioVigente(payload.id);
        if (!vigente || !vigente.activo) {
          return res.status(401).json({ error: 'La cuenta ya no está disponible.' });
        }
        user = {
          ...payload,
          rol: vigente.rol,
          empresa_id: vigente.empresa_id || null,
          cliente_id: vigente.cliente_id || null,
        };
        if (vigente.debe_cambiar_clave && !allowPending) {
          return res.status(403).json({
            error: 'Debes cambiar tu clave temporal antes de continuar.',
            code: 'CAMBIO_CLAVE_REQUERIDO',
          });
        }
        // Sin aceptación del tratamiento de datos no se opera con datos de la empresa.
        if (!allowPending && requiereTratamientoDatos(vigente) && !vigente.datos_aceptados) {
          return res.status(403).json({
            error: 'Falta aceptar el tratamiento de datos de la empresa.',
            code: 'TRATAMIENTO_DATOS_PENDIENTE',
          });
        }
      } catch (error) {
        console.error('[auth/usuario-vigente]', error);
        return res.status(503).json({ error: 'No se pudo verificar la cuenta.' });
      }

      req.user = user;

      // El supervisor maestro es global y no pertenece a una empresa.
      if (user.rol === 'superadmin' || !user.empresa_id) {
        return next();
      }

      try {
        let empresa = await getEmpresaEstado(user.empresa_id);
        empresa = await expireTrialIfNeeded(empresa);
        const access = empresaAccess(empresa);
        if (!access.allowed) {
          return res.status(403).json({ error: access.error, code: access.code });
        }
        return next();
      } catch (error) {
        console.error('[auth/estado-empresa]', error);
        return res.status(503).json({
          error: 'No se pudo verificar el estado de la empresa.',
        });
      }
    });
  };
}

const authenticateToken = makeAuthenticator({ allowPending: false });
// Solo para /auth/me, /auth/cambiar-clave y /datos: permite entrar con la clave
// temporal o el tratamiento de datos aún pendientes.
const authenticateAllowingPending = makeAuthenticator({ allowPending: true });

module.exports = {
  authenticateToken,
  authenticateAllowingPending,
  requiereTratamientoDatos,
  clearEmpresaStatusCache,
  clearUsuarioCache,
  empresaAccess,
  expireTrialIfNeeded,
};
