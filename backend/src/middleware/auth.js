const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { getJwtSecret, JWT_ALGORITHM } = require('../config/jwt');

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

async function usuarioActivo(userId) {
  const key = String(userId);
  const cached = usuarioCache.get(key);
  if (cached && Date.now() - cached.at < ESTADO_CACHE_TTL) return cached.activo;
  const result = await pool.query('SELECT activo FROM usuarios WHERE id = $1', [userId]);
  const activo = Boolean(result.rows[0]?.activo);
  usuarioCache.set(key, { activo, at: Date.now() });
  return activo;
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

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  jwt.verify(token, getJwtSecret(), { algorithms: [JWT_ALGORITHM] }, async (err, user) => {
    if (err) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    req.user = user;

    try {
      if (!(await usuarioActivo(user.id))) {
        return res.status(401).json({ error: 'La cuenta ya no está disponible.' });
      }
    } catch (error) {
      console.error('[auth/usuario-activo]', error);
      return res.status(503).json({ error: 'No se pudo verificar la cuenta.' });
    }

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

module.exports = {
  authenticateToken,
  clearEmpresaStatusCache,
  clearUsuarioCache,
  empresaAccess,
  expireTrialIfNeeded,
};
