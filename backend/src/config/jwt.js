/**
 * Secreto de firma de los JWT.
 *
 * En producción JWT_SECRET es obligatorio: sin él (o con un valor de ejemplo o
 * demasiado corto) el servidor se niega a arrancar, en lugar de firmar tokens
 * con un secreto conocido. Solo en desarrollo y pruebas (NODE_ENV=development
 * o test) se admite un secreto local de conveniencia.
 */

const MIN_LENGTH = 32;
const DEV_SECRET = 'turnsoft-solo-desarrollo-local-no-usar-en-produccion';
const LENIENT_ENVS = new Set(['development', 'test']);

const KNOWN_PLACEHOLDERS = new Set([
  'secret_dev',
  'cambia_este_valor_en_produccion',
  'cambiar_por_un_secreto_seguro_en_produccion',
]);

function getJwtSecret(env = process.env) {
  const secret = env.JWT_SECRET;
  const lenient = LENIENT_ENVS.has(env.NODE_ENV);

  if (!secret) {
    if (lenient) return DEV_SECRET;
    throw new Error(
      'JWT_SECRET no está definido. Define un secreto aleatorio de al menos ' +
        `${MIN_LENGTH} caracteres (por ejemplo: openssl rand -hex 48).`
    );
  }

  if (!lenient) {
    if (KNOWN_PLACEHOLDERS.has(secret)) {
      throw new Error('JWT_SECRET usa un valor de ejemplo. Genera un secreto propio.');
    }
    if (secret.length < MIN_LENGTH) {
      throw new Error(`JWT_SECRET debe tener al menos ${MIN_LENGTH} caracteres.`);
    }
  }

  return secret;
}

const JWT_ALGORITHM = 'HS256';

module.exports = { getJwtSecret, JWT_ALGORITHM, MIN_LENGTH };
