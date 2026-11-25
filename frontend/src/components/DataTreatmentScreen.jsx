import { useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
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

const STEPS = [
  { id: 'cuenta', label: 'Cuenta creada', state: 'done' },
  { id: 'datos', label: 'Tratamiento de datos', state: 'current' },
  { id: 'listo', label: 'Listo para usar', state: 'next' },
];

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
  const [showFull, setShowFull] = useState(false);
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
    <div className="dt-page">
      <header className="dt-top">
        <div className="dt-brand">
          <BrandMark size={34} />
          <div>
            <strong>SAFETURN</strong>
            <span>Turnos para Chile</span>
          </div>
        </div>
        <div className="dt-top-right">
          {session?.email ? <span className="dt-user">{session.email}</span> : null}
          <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
            <LogOut size={15} />
            <span>Salir</span>
          </button>
        </div>
      </header>

      <main className="dt-main">
        <ol className="dt-steps" aria-label="Progreso">
          {STEPS.map((step, index) => (
            <li key={step.id} className={`dt-step is-${step.state}`}>
              <span className="dt-step-dot">
                {step.state === 'done' ? <Check size={13} strokeWidth={3} /> : index + 1}
              </span>
              <span className="dt-step-label">{step.label}</span>
            </li>
          ))}
        </ol>

        <form className="dt-card" onSubmit={submit} noValidate>
          <div className="dt-card-head">
            <span className="dt-head-icon"><ShieldCheck size={22} /></span>
            <div>
              <span className="dt-eyebrow">Primer ingreso</span>
              <h1>Tratamiento de datos de tu empresa</h1>
              <p>
                Tu empresa es la responsable de los datos de su personal y SAFETURN
                los trata por encargo suyo. Revisa los puntos esenciales y acepta
                para empezar a usar la plataforma.
              </p>
            </div>
          </div>

          <section className="dt-section">
            <h2 className="dt-h">Lo esencial</h2>
            <div className="dt-grid">
              {TRATAMIENTO_RESUMEN.map((item) => {
                const Icon = ICONS[item.id] || ShieldCheck;
                return (
                  <div className="dt-item" key={item.id}>
                    <span className="dt-item-icon"><Icon size={17} /></span>
                    <strong>{item.titulo}</strong>
                    <p>{item.texto}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="dt-section dt-section-flush">
            <button
              type="button"
              className="dt-toggle"
              aria-expanded={showFull}
              onClick={() => setShowFull((value) => !value)}
            >
              <span><FileText size={16} /> Texto completo del tratamiento</span>
              <ChevronDown size={18} className={showFull ? 'is-open' : ''} />
            </button>
            {showFull ? (
              <div className="dt-full">
                {TRATAMIENTO_CLAUSULAS.map((clausula) => (
                  <article key={clausula.titulo}>
                    <h3>{clausula.titulo}</h3>
                    <p>{clausula.texto}</p>
                  </article>
                ))}
              </div>
            ) : null}
          </section>

          {canManageUsers ? (
            <>
              <section className="dt-section">
                <h2 className="dt-h">Quién acepta por la empresa</h2>
                <p className="dt-hint">
                  Queda registrado con la fecha y la versión del texto aceptado.
                </p>
                <div className="dt-fields">
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
                  <label className="field">
                    <span className="field-label">Correo de privacidad</span>
                    <input
                      className="input"
                      type="email"
                      value={form.email_privacidad}
                      onChange={(event) => set('email_privacidad', event.target.value)}
                      placeholder="privacidad@empresa.cl"
                    />
                  </label>
                </div>

                <div className="dt-checks">
                  <label className="dt-check">
                    <input
                      type="checkbox"
                      checked={form.declara}
                      onChange={(event) => set('declara', event.target.checked)}
                    />
                    <span>
                      Declaro que mi empresa cuenta con una base legal para tratar los
                      datos de su personal en SAFETURN y que informará a sus trabajadores.
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
                      descrito en este documento.
                    </span>
                  </label>
                </div>
              </section>

              {error ? <div className="form-error">{error}</div> : null}

              <footer className="dt-footer">
                <small>
                  Versión {TRATAMIENTO_VERSION} · Ley N° 19.628, modificada por la Ley N° 21.719
                </small>
                <button type="submit" className="btn btn-primary btn-md" disabled={busy}>
                  <span>{busy ? 'Guardando…' : 'Aceptar y continuar'}</span>
                  <ArrowRight size={17} />
                </button>
              </footer>
            </>
          ) : (
            <div className="dt-wait">
              <strong>Falta la aceptación de la empresa</strong>
              <p>
                El acceso de la empresa o un administrador debe aceptar el tratamiento
                de datos antes de que puedas entrar. Avísale e inténtalo de nuevo.
              </p>
            </div>
          )}
        </form>

        <p className="dt-note">
          <Lock size={14} /> Tu personal no accede a SAFETURN y los datos nunca se
          venden ni se usan para publicidad.
        </p>
      </main>
    </div>
  );
}
