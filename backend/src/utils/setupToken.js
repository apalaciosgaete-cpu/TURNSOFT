const crypto = require('crypto');

const LENIENT_ENVS = new Set(['development', 'test']);

function digest(value) {
  return crypto.createHash('sha256').update(String(value)).digest();
}

/**
 * Decide si una solicitud de configuración inicial está autorizada.
 *
 * - Con SETUP_TOKEN definido, el código enviado debe coincidir.
 * - Sin SETUP_TOKEN, la configuración inicial queda deshabilitada en producción
 *   (en desarrollo y pruebas se permite para no frenar el trabajo local).
 */
function checkSetupToken(provided, env = process.env) {
  const expected = env.SETUP_TOKEN;

  if (!expected) {
    if (LENIENT_ENVS.has(env.NODE_ENV)) return { ok: true };
    return {
      ok: false,
      status: 503,
      error:
        'La configuración inicial está deshabilitada. Define SETUP_TOKEN en el servidor para habilitarla.',
    };
  }

  const matches = crypto.timingSafeEqual(digest(provided || ''), digest(expected));
  if (!matches) {
    return { ok: false, status: 403, error: 'El código de instalación no es válido.' };
  }
  return { ok: true };
}

module.exports = { checkSetupToken };
