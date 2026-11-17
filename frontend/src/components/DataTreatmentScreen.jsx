import { useState } from 'react';
import {
  ArrowRight,
  Cloud,
  Database,
  FileText,
  Lock,
  LogOut,
  Scale,
  ShieldCheck,
  Target,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../store/AuthContext.jsx';
import { BrandMark } from './Brand.jsx';
import {
  TRATAMIENTO_CLAUSULAS,
  TRATAMIENTO_RESUMEN,
  TRATAMIENTO_VERSION,
} from '../data/tratamientoDatos.js';
import './datatreatment.css';

const ICONS = {
  roles: Scale,
  datos: Database,
  fin: Target,
  derechos: UserCheck,
  seguridad: Lock,
  nube: Cloud,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Primer ingreso de la empresa: aceptación del tratamiento de datos personales. */
export function DataTreatmentScreen() {
  const { session, canManageUsers, acceptDataTreatment, logout } = useAuth();
  const [form, setForm] = useState({
    nombre: '',
    cargo: '',
    email_privacidad: session?.email || '',
    declara: false,
    acepta: false,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key, value) => {
    setError('');
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (form.nombre.trim().length < 3) return setError('Ingresa el nombre de quien acepta por la empresa.');
    if (form.cargo.trim().length < 2) return setError('Ingresa el cargo de quien acepta.');
    if (!EMAIL_RE.test(form.email_privacidad.trim())) {
      return setError('Ingresa un correo válido para consultas de privacidad.');
    }
    if (!form.declara || !form.acepta) return setError('Marca ambas declaraciones para continuar.');
    setBusy(true);
    try {
      await acceptDataTreatment({
        version: TRATAMIENTO_VERSION,
        nombre: form.nombre.trim(),
        cargo: form.cargo.trim(),
        email_privacidad: form.email_privacidad.trim(),
        declara_base_legal: true,
        acepta: true,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-shell register-shell">
      <section className="login-story register-story">
        <div className="login-brand">
          <BrandMark size={44} className="login-brand-mark" />
          <div>
            <strong>TURNSOFT</strong>
            <span>Turnos para Chile</span>
          </div>
        </div>

        <div className="login-story-copy">
          <span className="login-eyebrow">
            <ShieldCheck size={15} /> Primer ingreso
          </span>
          <h1>Los datos de tu empresa,<br />en regla.</h1>
          <p>
            Antes de empezar, dejamos claro quién es responsable de qué. Es un
            solo paso y queda registrado.
          </p>
          <div className="dt-story-points">
            <div><ShieldCheck size={16} /> Tu personal no ve ni edita nada en TURNSOFT</div>
            <div><Lock size={16} /> Datos aislados por empresa</div>
            <div><FileText size={16} /> Basado en la Ley 19.628 y la Ley 21.719</div>
          </div>
        </div>

        <div className="login-story-foot">
          <Lock size={15} />
          <span>Tus datos nunca se venden ni se usan para publicidad</span>
        </div>
      </section>

      <section className="login-panel register-panel">
        <form className="login-card register-card dt-card" onSubmit={submit}>
          <div>
            <span className="login-card-eyebrow">Tratamiento de datos</span>
            <h2>Lo esencial, en seis puntos</h2>
          </div>

          <div className="dt-tiles">
            {TRATAMIENTO_RESUMEN.map((item) => {
              const Icon = ICONS[item.id] || ShieldCheck;
              return (
                <div className="dt-tile" key={item.id}>
                  <span className="dt-tile-icon"><Icon size={16} /></span>
                  <div>
                    <strong>{item.titulo}</strong>
                    <p>{item.texto}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <details className="dt-full">
            <summary>
              <FileText size={15} /> Leer el texto completo
            </summary>
            <div className="dt-full-body">
              {TRATAMIENTO_CLAUSULAS.map((clausula) => (
                <section key={clausula.titulo}>
                  <h4>{clausula.titulo}</h4>
                  <p>{clausula.texto}</p>
                </section>
              ))}
              <small>Versión {TRATAMIENTO_VERSION}</small>
            </div>
          </details>

          {canManageUsers ? (
            <>
              <div className="login-section">
                <div className="login-section-head">
                  <span className="login-section-icon"><UserCheck size={16} /></span>
                  <div>
                    <strong>Quién acepta por la empresa</strong>
                    <small>Queda registrado junto con la fecha y la versión del texto.</small>
                  </div>
                </div>
                <div className="register-grid">
                  <label className="field">
                    <span className="field-label">Nombre completo</span>
                    <input
                      className="input"
                      value={form.nombre}
                      onChange={(event) => set('nombre', event.target.value)}
                      placeholder="Nombre y apellido"
                      autoComplete="name"
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">Cargo</span>
                    <input
                      className="input"
                      value={form.cargo}
                      onChange={(event) => set('cargo', event.target.value)}
                      placeholder="Ej. Gerente general"
                      autoComplete="organization-title"
                    />
                  </label>
                  <label className="field register-full">
                    <span className="field-label">Correo para consultas de privacidad</span>
                    <input
                      className="input"
                      type="email"
                      value={form.email_privacidad}
                      onChange={(event) => set('email_privacidad', event.target.value)}
                      placeholder="privacidad@empresa.cl"
                    />
                  </label>
                </div>
              </div>

              <label className="dt-check">
                <input
                  type="checkbox"
                  checked={form.declara}
                  onChange={(event) => set('declara', event.target.checked)}
                />
                <span>
                  Declaro que mi empresa cuenta con una base legal para tratar los
                  datos de su personal en TURNSOFT y que informará a sus trabajadores.
                </span>
              </label>
              <label className="dt-check">
                <input
                  type="checkbox"
                  checked={form.acepta}
                  onChange={(event) => set('acepta', event.target.checked)}
                />
                <span>
                  Acepto, en representación de la empresa, el tratamiento de datos
                  descrito (versión {TRATAMIENTO_VERSION}).
                </span>
              </label>

              {error ? <div className="form-error">{error}</div> : null}

              <button type="submit" className="btn btn-primary btn-md login-submit" disabled={busy}>
                <span>{busy ? 'Guardando…' : 'Aceptar y entrar a TURNSOFT'}</span>
                <ArrowRight size={17} />
              </button>
            </>
          ) : (
            <div className="dt-wait">
              <strong>Falta la aceptación de la empresa</strong>
              <p>
                El acceso de la empresa o un administrador debe aceptar el
                tratamiento de datos antes de que puedas entrar. Avísale e
                inténtalo de nuevo.
              </p>
            </div>
          )}

          <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
            <LogOut size={15} />
            <span>Salir</span>
          </button>
        </form>
      </section>
    </div>
  );
}
