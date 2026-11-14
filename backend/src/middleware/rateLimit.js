const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

/**
 * Límites de solicitudes contra abuso (fuerza bruta, registros masivos).
 *
 * La API suele quedar detrás de proxies (Vercel -> Render), por lo que no se
 * confía en `req.ip` ni en un número fijo de saltos: se usa la primera IP de
 * X-Forwarded-For (Vercel la sobrescribe con la IP real del cliente) y, si no
 * existe, la IP del socket. Es una defensa de mejor esfuerzo: quien llame
 * directo al servidor de origen puede falsear ese encabezado.
 */

const MINUTE = 60 * 1000;

function clientKey(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const first = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '';
  return ipKeyGenerator(first || req.ip || 'desconocido');
}

function accountKey(req) {
  const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 200);
  return email ? `cuenta:${email}` : `ip:${clientKey(req)}`;
}

function build({ windowMs, limit, message, keyGenerator = clientKey, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    limit,
    keyGenerator,
    skipSuccessfulRequests,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: message },
    validate: { xForwardedForHeader: false, trustProxy: false },
  });
}

// Inicio de sesión: solo cuentan los intentos fallidos.
const loginPorIp = build({
  windowMs: 15 * MINUTE,
  limit: 30,
  skipSuccessfulRequests: true,
  message: 'Demasiados intentos fallidos desde tu conexión. Espera unos minutos e inténtalo de nuevo.',
});

const loginPorCuenta = build({
  windowMs: 15 * MINUTE,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: accountKey,
  message: 'Demasiados intentos fallidos para esta cuenta. Espera unos minutos e inténtalo de nuevo.',
});

const registro = build({
  windowMs: 60 * MINUTE,
  limit: 5,
  message: 'Se alcanzó el máximo de registros desde tu conexión. Inténtalo más tarde.',
});

const setup = build({
  windowMs: 60 * MINUTE,
  limit: 5,
  message: 'Demasiados intentos de configuración inicial. Inténtalo más tarde.',
});

// El motor de horarios es público y consume CPU: se limita por conexión.
const motor = build({
  windowMs: MINUTE,
  limit: 60,
  message: 'Demasiadas solicitudes al motor de horarios. Espera un momento.',
});

module.exports = { loginPorIp, loginPorCuenta, registro, setup, motor, clientKey };
