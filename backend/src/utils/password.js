const crypto = require('crypto');

/** Hash de contraseña con scrypt. Formato: scrypt:<salt>:<hash>. */
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const [scheme, salt, hash] = stored.split(':');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const candidate = crypto.scryptSync(String(password), salt, 64);
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

const TEMP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; // 56 símbolos

/** Clave temporal legible (sin 0/O, 1/l/I), sin sesgo de módulo. */
function generateTempPassword(length = 12) {
  let out = '';
  while (out.length < length) {
    const byte = crypto.randomBytes(1)[0];
    if (byte < 224) out += TEMP_ALPHABET[byte % TEMP_ALPHABET.length]; // 224 = 56 * 4
  }
  return out;
}

module.exports = { hashPassword, verifyPassword, generateTempPassword };
