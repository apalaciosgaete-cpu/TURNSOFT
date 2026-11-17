import { useState } from 'react';
import { KeyRound, LockKeyhole, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../store/AuthContext.jsx';
import { BrandMark } from './Brand.jsx';

/** Pantalla obligatoria al entrar con una clave temporal entregada por el administrador. */
export function ChangePasswordScreen() {
  const { session, changePassword, logout } = useAuth();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repite, setRepite] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!actual) return setError('Ingresa la clave temporal que te entregaron.');
    if (nueva.length < 8) return setError('La clave nueva debe tener al menos 8 caracteres.');
    if (nueva !== repite) return setError('Las claves nuevas no coinciden.');
    setBusy(true);
    try {
      await changePassword(actual, nueva);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-shell" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <section className="login-panel" style={{ alignItems: 'center' }}>
        <form className="login-card" onSubmit={submit}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink)' }}>
            <BrandMark size={40} />
            <strong style={{ fontSize: 18, letterSpacing: '0.04em' }}>TURNSOFT</strong>
          </div>

          <div>
            <span className="login-card-eyebrow">Primer acceso</span>
            <h2>Crea tu propia clave</h2>
          </div>
          <p className="login-card-sub">
            Hola {session?.name}. Entraste con una clave temporal: elige una
            clave personal para proteger tu cuenta. Solo tú la conocerás.
          </p>

          {error ? <div className="form-error">{error}</div> : null}

          <label className="field">
            <span className="field-label">Clave temporal</span>
            <div className="login-input-wrap">
              <KeyRound size={16} />
              <input
                className="input"
                type="password"
                value={actual}
                onChange={(event) => setActual(event.target.value)}
                autoComplete="current-password"
              />
            </div>
          </label>

          <label className="field">
            <span className="field-label">Clave nueva</span>
            <div className="login-input-wrap">
              <LockKeyhole size={16} />
              <input
                className="input"
                type="password"
                value={nueva}
                onChange={(event) => setNueva(event.target.value)}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
              />
            </div>
          </label>

          <label className="field">
            <span className="field-label">Repite la clave nueva</span>
            <div className="login-input-wrap">
              <LockKeyhole size={16} />
              <input
                className="input"
                type="password"
                value={repite}
                onChange={(event) => setRepite(event.target.value)}
                autoComplete="new-password"
              />
            </div>
          </label>

          <button type="submit" className="btn btn-primary btn-md login-submit" disabled={busy}>
            <span>{busy ? 'Guardando…' : 'Guardar y entrar'}</span>
            <ShieldCheck size={17} />
          </button>

          <button type="button" className="btn btn-ghost btn-sm login-submit" onClick={logout}>
            <LogOut size={15} />
            <span>Salir</span>
          </button>
        </form>
      </section>
    </div>
  );
}
