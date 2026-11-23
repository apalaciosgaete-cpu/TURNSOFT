// Prepara el logo de la empresa en el navegador: lo reduce y lo codifica como imagen
// pequeña para que el servidor reciba pocos KB y nunca el archivo original.

const TIPOS = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_ORIGINAL = 8 * 1024 * 1024;
const MAX_CHARS = 140000; // el servidor acepta hasta 150000
const LADOS = [256, 192, 128];

async function cargarImagen(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Se intenta con <img> más abajo.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function dibujar(imagen, lado) {
  const ancho = imagen.width || imagen.naturalWidth;
  const alto = imagen.height || imagen.naturalHeight;
  const escala = Math.min(1, lado / Math.max(ancho, alto));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(ancho * escala));
  canvas.height = Math.max(1, Math.round(alto * escala));
  const contexto = canvas.getContext('2d');
  contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height);
  // WebP conserva la transparencia con poco peso; si el navegador no lo codifica, devuelve PNG.
  return canvas.toDataURL('image/webp', 0.9);
}

/** Devuelve una data URL lista para enviar, o lanza un Error con un mensaje claro. */
export async function prepararLogo(file) {
  if (!file) throw new Error('Elige una imagen.');
  if (!TIPOS.includes(file.type)) {
    throw new Error('El logo debe ser una imagen PNG, JPG o WebP.');
  }
  if (file.size > MAX_ORIGINAL) {
    throw new Error('La imagen pesa demasiado. Elige una de menos de 8 MB.');
  }
  const imagen = await cargarImagen(file);
  for (const lado of LADOS) {
    const url = dibujar(imagen, lado);
    if (url.length <= MAX_CHARS) return url;
  }
  throw new Error('No se pudo reducir la imagen lo suficiente. Prueba con otra.');
}
