import { useRef, useState } from 'react';
import { useAuth } from '../store/AuthContext.jsx';
import { useTurnsoft } from '../store/TurnsoftContext.jsx';
import { prepararLogo } from '../lib/logo.js';

function companyInitials(name) {
  return (
    String(name || 'E')
      .split(/\s+/)
      .filter((part) => part.length > 1 || /\d/.test(part))
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'E'
  );
}

/** Logo de la empresa; si aún no hay, sus iniciales. */
export function CompanyMark({ name, logo, size = 44, className = '' }) {
  return (
    <span
      className={`company-mark ${logo ? 'has-logo' : ''} ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {logo ? <img src={logo} alt={`Logo de ${name || 'la empresa'}`} /> : companyInitials(name)}
    </span>
  );
}

/** Subir y quitar el logo: lo usan el menú lateral y la página Mi empresa. */
export function useCompanyLogo() {
  const { session, canManageUsers, updateCompanyLogo } = useAuth();
  const { notify } = useTurnsoft();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const canEdit = Boolean(canManageUsers && session?.empresaId);

  const pick = () => {
    if (canEdit && !busy) inputRef.current?.click();
  };

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const imagen = await prepararLogo(file);
      await updateCompanyLogo(imagen);
      notify('Logo de la empresa actualizado.');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!canEdit || busy) return;
    setBusy(true);
    try {
      await updateCompanyLogo(null);
      notify('Logo eliminado.', 'info');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/png,image/jpeg,image/webp"
      hidden
      onChange={onFile}
    />
  );

  return { canEdit, busy, pick, remove, input, hasLogo: Boolean(session?.empresaLogo) };
}
