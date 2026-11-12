const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const ESTADO_CACHE_TTL = 30000;
const estadoCache = new Map();

async function getEmpresaEstado(empresaId) {
  const key = String(empresaId);
  const cached = estadoCache.get(key);
  if (cached && Date.now() - cached.at < ESTADO_CACHE_TTL) {
    return cached.estado;
  }

  const result = await pool.query('SELECT estado FROM empresas WHERE id = $1', [empresaId]);
  const estado = result.rows[0]?.estado || null;
  estadoCache.set(key, { estado, at: Date.now() });
  return estado;
}

function clearEmpresaStatusCache(empresaId) {
  if (empresaId) {
    estadoCache.delete(String(empresaId));
    return;
  }
  estadoCache.clear();
}

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'secret_dev', async (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido o expirado' });
    }

    req.user = user;

    // El supervisor maestro es global y no pertenece a una empresa.
    if (user.rol === 'superadmin' || !user.empresa_id) {
      return next();
    }

    try {
      const estado = await getEmpresaEstado(user.empresa_id);
      if (!estado) {
        return res.status(403).json({
          error: 'La empresa asociada a tu cuenta ya no está disponible.',
          code: 'EMPRESA_INACTIVA',
        });
      }
      if (estado !== 'activa') {
        return res.status(403).json({
          error: 'La cuenta de tu empresa está suspendida por falta de pago. Contacta a TURNSOFT para regularizar la situación.',
          code: 'EMPRESA_SUSPENDIDA',
        });
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
};
