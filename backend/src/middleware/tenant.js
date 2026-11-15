/** Utilidades de alcance por empresa y cliente. */

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/**
 * Roles internos de la empresa:
 * - operador: titular, creado al registrar la empresa.
 * - admin: administrador, gestiona usuarios, datos y horarios.
 * - validador: ve toda la operación y aprueba horarios y solicitudes.
 * Un usuario sin cliente asignado y sin rol conocido se trata como operador
 * (tokens legacy).
 */
const ROLES_INTERNOS = ['operador', 'admin', 'validador'];

/** Cuenta que puede modificar datos de la empresa (titular o administrador). */
function isOperator(user) {
  if (!user) return false;
  if (user.rol === 'superadmin' || user.rol === 'validador') return false;
  return !user.cliente_id || user.rol === 'operador' || user.rol === 'admin';
}

function isValidador(user) {
  return Boolean(user && user.rol === 'validador');
}

/** Gestiona usuarios internos: titular y administrador. */
function canManageUsers(user) {
  return Boolean(user && (user.rol === 'operador' || user.rol === 'admin'));
}

/** Aprueba horarios y solicitudes: titular, administrador y validador. */
function canApprove(user) {
  return canManageUsers(user) || isValidador(user);
}

function isSuperadmin(user) {
  return Boolean(user && user.rol === 'superadmin');
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

/** El validador consulta y aprueba, pero no modifica datos. */
function denyValidador(req, res, next) {
  if (isValidador(req.user)) {
    return res.status(403).json({ error: 'Tu cuenta de validador solo puede consultar y aprobar.' });
  }
  next();
}

function requireApprover(req, res, next) {
  if (!canApprove(req.user)) {
    return res.status(403).json({ error: 'Esta acción requiere una cuenta que pueda aprobar.' });
  }
  next();
}

function requireUserManager(req, res, next) {
  if (!canManageUsers(req.user)) {
    return res.status(403).json({ error: 'Solo el titular o un administrador pueden gestionar usuarios.' });
  }
  next();
}

function requireSuperadmin(req, res, next) {
  if (!isSuperadmin(req.user)) {
    return res.status(403).json({ error: 'Esta acción requiere la cuenta de supervisor maestro.' });
  }
  next();
}

module.exports = {
  ROLES_INTERNOS,
  isOperator,
  isValidador,
  canManageUsers,
  canApprove,
  denyValidador,
  requireApprover,
  requireUserManager,
  isSuperadmin,
  scopedClienteId,
  scopedEmpresaId,
  assertClienteAccess,
  assertEmpresaAccess,
  requireOperator,
  requireSuperadmin,
  httpError,
};
