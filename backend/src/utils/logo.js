// Validación del logo de la empresa. Se guarda como data URL pequeña dentro de la ficha.
// Solo PNG, JPEG o WebP: se descarta SVG porque puede llevar scripts.

const MAX_CHARS = 150000; // ~110 KB de imagen; el frontend lo reduce a 256 px antes de enviarlo
const DATA_URL_RE = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

function firmaValida(tipo, bytes) {
  if (tipo === 'png') {
    return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  if (tipo === 'jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  // WebP: "RIFF" .... "WEBP"
  return (
    bytes.length >= 12 &&
    bytes.toString('latin1', 0, 4) === 'RIFF' &&
    bytes.toString('latin1', 8, 12) === 'WEBP'
  );
}

/** Devuelve { value } si el logo es válido o { error } con el motivo en español. */
function validarLogo(entrada) {
  if (typeof entrada !== 'string' || !entrada) {
    return { error: 'Envía la imagen del logo.' };
  }
  if (entrada.length > MAX_CHARS) {
    return { error: 'La imagen es demasiado pesada. Usa un logo de menos de 100 KB.' };
  }
  const match = DATA_URL_RE.exec(entrada);
  if (!match) {
    return { error: 'El logo debe ser una imagen PNG, JPG o WebP.' };
  }
  const bytes = Buffer.from(match[2], 'base64');
  if (!firmaValida(match[1], bytes)) {
    return { error: 'El archivo no es una imagen válida.' };
  }
  return { value: entrada };
}

module.exports = { validarLogo, MAX_CHARS };
