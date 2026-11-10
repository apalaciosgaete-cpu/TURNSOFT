/** Utilidades de alcance por empresa y cliente. */

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/** Un usuario sin cliente asignado es operador (incluye tokens legacy). */
function isOperator(user) {
  if (!user) return false;
  return !user.cliente_id || user.rol === 'operador' || user.rol === 'admin';
}

/**
 * Devuelve el cliente que puede consultar el usuario.
 * - Usuario cliente: siempre su propio cliente; pedir otro lanza 403.
 * - Operador: usa el filtro solicitado, o null para ver todos.
 */
function scopedClienteId(user, requestedClienteId = null) {
  if (!user) return requestedClienteId || null;
  if (user.cliente_id) {
    if (requestedClienteId && String(requestedClienteId) !== String(user.cliente_id)) {
      throw httpError(403, 'No tienes acceso a los datos de otro cliente.');
    }
    return user.cliente_id;
  }
  return requestedClienteId || null;
}

/** Limita la empresa al ámbito del token, salvo tokens demo sin empresa. */
function scopedEmpresaId(user, requestedEmpresaId = null) {
  if (!user || !user.empresa_id) return requestedEmpresaId || null;
  if (requestedEmpresaId && String(requestedEmpresaId) !== String(user.empresa_id)) {
    throw httpError(403, 'No tienes acceso a otra empresa.');
  }
  return user.empresa_id;
}

function assertClienteAccess(user, clienteId) {
  if (!user || !clienteId) return;
  if (user.cliente_id && String(user.cliente_id) !== String(clienteId)) {
    throw httpError(403, 'No tienes acceso a los datos de otro cliente.');
  }
}

function assertEmpresaAccess(user, empresaId) {
  if (!user || !empresaId || !user.empresa_id) return;
  if (String(user.empresa_id) !== String(empresaId)) {
    throw httpError(403, 'No tienes acceso a otra empresa.');
  }
}

function requireOperator(req, res, next) {
  if (!req.user || !isOperator(req.user)) {
    return res.status(403).json({ error: 'Esta acción requiere una cuenta de operador.' });
  }
  next();
}

module.exports = {
  isOperator,
  scopedClienteId,
  scopedEmpresaId,
  assertClienteAccess,
  assertEmpresaAccess,
  requireOperator,
  httpError,
};
