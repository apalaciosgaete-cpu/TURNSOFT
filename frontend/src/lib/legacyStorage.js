// Cuando el producto se llamaba TURNSOFT, la sesión y las planificaciones se guardaban en el
// navegador con claves "turnsoft.*". Al pasar a SAFETURN se copian a las claves nuevas una sola
// vez, para que nadie pierda su sesión ni las planificaciones que tenga guardadas.
const FAMILIAS = [
  ['turnsoft.session.v3', 'safeturn.session.v3'],
  ['turnsoft.workspace.v4', 'safeturn.workspace.v4'],
];

export function migrateLegacyStorage() {
  try {
    const store = window.localStorage;
    const claves = [];
    for (let i = 0; i < store.length; i += 1) {
      const clave = store.key(i);
      if (clave) claves.push(clave);
    }
    for (const clave of claves) {
      const familia = FAMILIAS.find(([vieja]) => clave === vieja || clave.startsWith(`${vieja}:`));
      if (!familia) continue;
      const nueva = familia[1] + clave.slice(familia[0].length);
      if (store.getItem(nueva) === null) store.setItem(nueva, store.getItem(clave));
      store.removeItem(clave);
    }
  } catch {
    // Sin acceso al almacenamiento del navegador: no hay nada que migrar.
  }
}
