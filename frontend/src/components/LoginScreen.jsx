import { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  HeartPulse,
  KeyRound,
  LockKeyhole,
  Pickaxe,
  ShieldCheck,
  ShoppingBag,
  Truck,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../store/AuthContext.jsx';
import { BrandMark } from './Brand.jsx';

const LOGIN_SECTORS = [
  { label: 'Seguridad', Icon: ShieldCheck },
  { label: 'Salud', Icon: HeartPulse },
  { label: 'Minería', Icon: Pickaxe },
  { label: 'Retail', Icon: ShoppingBag },
  { label: 'Logística', Icon: Truck },
];
const EMPTY_SETUP = {
  nombre: '',
  email: '',
  password: '',
  confirm: '',
};

export function LoginScreen() {
  const {
    login,
    setup,
    authError,
    clearAuthError,
    busy,
    bootstrap,
    checkBootstrap,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [form, setForm] = useState(EMPTY_SETUP);
  const [formError, setFormError] = useState('');

  const isSetup = bootstrap.needsSetup;

  const submitLogin = async (event) => {
    event.preventDefault();
    await login(email, password);
  };

  const submitSetup = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!form.nombre.trim()) {
      setFormError('Ingresa el nombre del supervisor maestro.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setFormError('Ingresa un correo válido.');
      return;
    }
    if (form.password.length < 8) {
      setFormError('La clave debe tener al menos 8 caracteres.');
      return;
    }
    if (form.password !== form.confirm) {
      setFormError('Las claves no coinciden.');
      return;
    }

    const ok = await setup({
      nombre: form.nombre.trim(),
      email: form.email.trim(),
      password: form.password,
    });
    if (!ok) {
      // Si otra sesión completó el setup mientras tanto, refresca el estado.
      checkBootstrap();
    }
  };

  const set = (key, value) => {
    clearAuthError();
    setFormError('');
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  return (
    <div className="login-shell">
      <section className="login-story">
        <div className="login-brand">
          <BrandMark size={44} className="login-brand-mark" />
          <div>
            <strong>TURNSOFT</strong>
            <span>Turnos para Chile</span>
          </div>
        </div>

        <div className="login-story-copy">
          <span className="login-eyebrow">
            <ShieldCheck size={15} /> Operación multi-cliente
          </span>
          <h1>Toda tu operación<br />en un solo lugar.</h1>
          <p>
            Configura tu empresa, administra tus horarios para que cumplan con
            la normativa chilena. Cada cuenta ve únicamente su propia operación.
          </p>

          <div className="login-benefits">
            <div>
              <CheckCircle2 size={17} />
              <span><strong>Multi-cliente:</strong> una empresa operadora, muchos mandantes.</span>
            </div>
            <div>
              <CheckCircle2 size={17} />
              <span><strong>Aislamiento:</strong> cada cliente solo accede a sus datos.</span>
            </div>
            <div>
              <CheckCircle2 size={17} />
              <span><strong>Cumplimiento:</strong> jornada, descansos y feriados bajo control.</span>
            </div>
          </div>

          <div className="login-sector-strip">
            {LOGIN_SECTORS.map(({ label, Icon }) => (
              <span className="login-sector-tile" key={label}>
                <span className="login-sector-icon"><Icon size={18} strokeWidth={1.9} /></span>
                <span>{label}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="login-story-foot">
          <LockKeyhole size={15} />
          <span>Jornada ordinaria 42 h · reducción a 40 h desde el 26-04-2028</span>
        </div>
      </section>

      <section className="login-panel">
        {bootstrap.loading ? (
          <div className="login-card login-card-loading" aria-live="polite">
            <span className="login-card-eyebrow">TURNSOFT</span>
            <h2>Verificando la instalación…</h2>
            <p className="login-card-sub">
              Estamos comprobando si ya existe la cuenta de supervisor maestro.
              El servidor gratuito puede tardar hasta un minuto en despertar.
            </p>
            <div className="login-loading-bar" aria-hidden="true"><span /></div>
          </div>
        ) : isSetup ? (
          <form className="login-card" onSubmit={submitSetup}>
            <span className="login-card-eyebrow">Configuración inicial</span>
            <h2>Crea la cuenta de supervisor maestro</h2>
            <p className="login-card-sub">
              Este paso se realiza una sola vez. La cuenta maestra es global:
              administra empresas, pagos, planes y soporte de toda la plataforma.
            </p>

            {authError || formError ? (
              <div className="form-error">{formError || authError}</div>
            ) : null}

            <div className="login-section">
              <div className="login-section-head">
                <span className="login-section-icon"><UserRound size={16} /></span>
                <div>
                  <strong>Cuenta maestra</strong>
                  <small>Acceso total a la consola de TURNSOFT.</small>
                </div>
              </div>

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
                <span className="field-label">Correo</span>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(event) => set('email', event.target.value)}
                  placeholder="supervisor@turnsoft.cl"
                  autoComplete="username"
                />
              </label>

              <div className="login-grid-2">
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

            <button type="submit" className="btn btn-primary btn-md login-submit" disabled={busy}>
              <span>{busy ? 'Creando cuenta maestra…' : 'Crear cuenta y entrar'}</span>
              <ArrowRight size={17} />
            </button>

            <p className="login-coldstart">
              Al entrar podrás crear la primera empresa operadora, asignarle un
              plan y registrar sus pagos.
            </p>
          </form>
        ) : (
          <form className="login-card" onSubmit={submitLogin}>
            <span className="login-card-eyebrow">Acceso seguro</span>
            <h2>Inicia sesión</h2>
            <p className="login-card-sub">
              Ingresa con tu cuenta para administrar tus clientes, dotación y
              horarios.
            </p>

            {authError ? <div className="form-error">{authError}</div> : null}

            <label className="field">
              <span className="field-label">Correo</span>
              <div className="login-input-wrap">
                <UserRound size={16} />
                <input
                  className="input"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => {
                    clearAuthError();
                    setEmail(event.target.value);
                  }}
                  placeholder="tu@empresa.cl"
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
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => {
                    clearAuthError();
                    setPassword(event.target.value);
                  }}
                  placeholder="Tu clave"
                />
              </div>
            </label>

            <button type="submit" className="btn btn-primary btn-md login-submit" disabled={busy}>
              <span>{busy ? 'Conectando con el servidor…' : 'Entrar a TURNSOFT'}</span>
              <ArrowRight size={17} />
            </button>

            <p className="login-coldstart">
              El servidor gratuito puede tardar hasta un minuto en despertar tras
              un período sin uso.
            </p>
          </form>
        )}

        <p className="login-help">
          <LockKeyhole size={14} />
          ¿Problemas para entrar? Contacta al administrador de tu empresa.
        </p>
      </section>
    </div>
  );
}
