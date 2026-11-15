import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  KeyRound,
  LockKeyhole,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { SECTOR_META } from '@shared/legal.js';
import { useAuth } from '../store/AuthContext.jsx';
import { BrandMark } from '../components/Brand.jsx';

const SECTORES = Object.values(SECTOR_META);
const EMPTY = {
  razon_social: '',
  rut_empresa: '',
  sector: 'seguridad',
  email_contacto: '',
  telefono: '',
  direccion: '',
  ciudad: '',
  nombre: '',
  email: '',
  password: '',
  confirm: '',
};

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function validRut(value) {
  const normalized = String(value || '').replace(/\./g, '').replace(/\s/g, '').toUpperCase();
  return /^\d{6,8}-[0-9kK]$/.test(normalized);
}

export default function RegisterPage() {
  const { register, authError, clearAuthError, busy } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const set = (key, value) => {
    clearAuthError();
    setError('');
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (form.razon_social.trim().length < 2) return setError('Ingresa la razón social de la empresa.');
    if (!validRut(form.rut_empresa)) return setError('Ingresa un RUT válido, por ejemplo 76.123.456-7.');
    if (form.email_contacto && !isValidEmail(form.email_contacto)) {
      return setError('Ingresa un correo de contacto válido.');
    }
    if (!form.nombre.trim()) return setError('Ingresa el nombre del administrador.');
    if (!isValidEmail(form.email)) return setError('Ingresa un correo válido para el administrador.');
    if (form.password.length < 8) return setError('La clave debe tener al menos 8 caracteres.');
    if (form.password !== form.confirm) return setError('Las claves no coinciden.');

    await register({
      empresa: {
        razon_social: form.razon_social.trim(),
        rut_empresa: form.rut_empresa.trim(),
        sector: form.sector,
        email_contacto: form.email_contacto.trim(),
        telefono: form.telefono.trim(),
        direccion: form.direccion.trim(),
        ciudad: form.ciudad.trim(),
      },
      admin: {
        nombre: form.nombre.trim(),
        email: form.email.trim(),
        password: form.password,
      },
    });
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
            <Sparkles size={15} /> 15 días de prueba
          </span>
          <h1>Tu empresa entra<br />y prueba TURNSOFT.</h1>
          <p>
            Crea la cuenta de tu empresa y comienza a ordenar
            clientes, trabajadores y horarios. Sin tarjeta para empezar.
          </p>

          <div className="login-benefits">
            <div>
              <CheckCircle2 size={17} />
              <span><strong>Prueba completa:</strong> 15 días con acceso a toda la operación.</span>
            </div>
            <div>
              <CheckCircle2 size={17} />
              <span><strong>Sin compromiso:</strong> no se pide plan ni medio de pago para probar.</span>
            </div>
            <div>
              <CheckCircle2 size={17} />
              <span><strong>Aislamiento:</strong> tu empresa solo ve su propia operación.</span>
            </div>
          </div>

          <div className="register-story-steps">
            <div>
              <span>1</span>
              <div>
                <strong>Registra tu empresa</strong>
                <small>Datos de la empresa y del administrador.</small>
              </div>
            </div>
            <div>
              <span>2</span>
              <div>
                <strong>Ordena tu base</strong>
                <small>Trabajadores y horarios de entrada/salida.</small>
              </div>
            </div>
            <div>
              <span>3</span>
              <div>
                <strong>Genera horarios</strong>
                <small>Clientes, escenarios y cumplimiento legal.</small>
              </div>
            </div>
          </div>
        </div>

        <div className="login-story-foot">
          <LockKeyhole size={15} />
          <span>Datos aislados por empresa · Operación alojada en Chile</span>
        </div>
      </section>

      <section className="login-panel register-panel">
        <form className="login-card register-card" onSubmit={submit}>
          <div className="register-card-head">
            <div>
              <span className="login-card-eyebrow">Registro de empresa</span>
              <h2>Crea tu cuenta</h2>
            </div>
            <Link className="register-login-link" to="/">
              Ya tengo cuenta <ArrowRight size={14} />
            </Link>
          </div>
          <p className="login-card-sub">
            La prueba de 15 días comienza al registrarte. Los planes se
            anunciarán antes del lanzamiento comercial.
          </p>

          {authError || error ? <div className="form-error">{error || authError}</div> : null}

          <div className="login-section">
            <div className="login-section-head">
              <span className="login-section-icon"><Building2 size={16} /></span>
              <div>
                <strong>Datos de la empresa</strong>
                <small>Así aparecerá tu operación en TURNSOFT.</small>
              </div>
            </div>

            <div className="register-grid">
              <label className="field register-full">
                <span className="field-label">Razón social</span>
                <input
                  className="input"
                  value={form.razon_social}
                  onChange={(event) => set('razon_social', event.target.value)}
                  placeholder="Ej. Seguridad Austral SpA"
                  autoComplete="organization"
                />
              </label>

              <label className="field">
                <span className="field-label">RUT de la empresa</span>
                <input
                  className="input"
                  value={form.rut_empresa}
                  onChange={(event) => set('rut_empresa', event.target.value)}
                  placeholder="76.123.456-7"
                />
              </label>

              <label className="field">
                <span className="field-label">Sector</span>
                <select
                  className="input"
                  value={form.sector}
                  onChange={(event) => set('sector', event.target.value)}
                >
                  {SECTORES.map((sector) => (
                    <option key={sector.id} value={sector.id}>{sector.label}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field-label">Correo de contacto</span>
                <input
                  className="input"
                  type="email"
                  value={form.email_contacto}
                  onChange={(event) => set('email_contacto', event.target.value)}
                  placeholder="contacto@empresa.cl"
                  autoComplete="email"
                />
              </label>

              <label className="field">
                <span className="field-label">Teléfono</span>
                <input
                  className="input"
                  value={form.telefono}
                  onChange={(event) => set('telefono', event.target.value)}
                  placeholder="+56 9 1234 5678"
                  autoComplete="tel"
                />
              </label>

              <label className="field register-full">
                <span className="field-label">Dirección</span>
                <input
                  className="input"
                  value={form.direccion}
                  onChange={(event) => set('direccion', event.target.value)}
                  placeholder="Av. Providencia 1234, oficina 56"
                  autoComplete="street-address"
                />
              </label>

              <label className="field register-full">
                <span className="field-label">Ciudad</span>
                <input
                  className="input"
                  value={form.ciudad}
                  onChange={(event) => set('ciudad', event.target.value)}
                  placeholder="Santiago"
                  autoComplete="address-level2"
                />
              </label>
            </div>
          </div>

          <div className="login-section">
            <div className="login-section-head">
              <span className="login-section-icon"><UserRound size={16} /></span>
              <div>
                <strong>Cuenta administradora</strong>
                <small>Con este acceso entrarás a la operación de tu empresa.</small>
              </div>
            </div>

            <div className="register-grid">
              <label className="field register-full">
                <span className="field-label">Nombre completo</span>
                <input
                  className="input"
                  value={form.nombre}
                  onChange={(event) => set('nombre', event.target.value)}
                  placeholder="Nombre y apellido"
                  autoComplete="name"
                />
              </label>

              <label className="field register-full">
                <span className="field-label">Correo de acceso</span>
                <div className="login-input-wrap">
                  <UserRound size={16} />
                  <input
                    className="input"
                    type="email"
                    value={form.email}
                    onChange={(event) => set('email', event.target.value)}
                    placeholder="admin@empresa.cl"
                    autoComplete="username"
                  />
                </div>
              </label>

              <label className="field">
                <span className="field-label">Clave</span>
                <div className="login-input-wrap">
                  <KeyRound size={16} />
                  <input
                    className="input"
                    type="password"
                    value={form.password}
                    onChange={(event) => set('password', event.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="new-password"
                  />
                </div>
              </label>

              <label className="field">
                <span className="field-label">Repite la clave</span>
                <div className="login-input-wrap">
                  <LockKeyhole size={16} />
                  <input
                    className="input"
                    type="password"
                    value={form.confirm}
                    onChange={(event) => set('confirm', event.target.value)}
                    placeholder="Repite la clave"
                    autoComplete="new-password"
                  />
                </div>
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-md login-submit"
            disabled={busy}
          >
            <span>{busy ? 'Creando tu empresa…' : 'Crear empresa y probar 15 días'}</span>
            <ArrowRight size={17} />
          </button>

          <p className="login-coldstart">
            Al crear la cuenta aceptas las condiciones de uso de TURNSOFT. Tus
            datos quedan aislados de las demás empresas de la plataforma.
          </p>
        </form>

        <p className="login-help">
          <LockKeyhole size={14} />
          ¿Ya registraste tu empresa? <Link className="register-help-link" to="/">Inicia sesión</Link>
        </p>
      </section>
    </div>
  );
}
