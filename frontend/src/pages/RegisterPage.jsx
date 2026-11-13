import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  CreditCard,
  Headphones,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { SECTOR_META } from '@shared/legal.js';
import { apiRequest, useAuth } from '../store/AuthContext.jsx';
import { money } from '../lib/format.js';
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
  plan_id: '',
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

function limitLabel(value, singular, plural) {
  if (value === null || value === undefined) return `Sin límite de ${plural}`;
  if (Number(value) === 1) return `1 ${singular}`;
  return `${value} ${plural}`;
}

export default function RegisterPage() {
  const { register, authError, clearAuthError, busy } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [planes, setPlanes] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [plansError, setPlansError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest('/public/planes');
        if (!cancelled) setPlanes(Array.isArray(data) ? data : []);
      } catch (requestError) {
        if (!cancelled) setPlansError(requestError.message);
      } finally {
        if (!cancelled) setLoadingPlans(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedPlan = useMemo(
    () => planes.find((plan) => plan.id === form.plan_id) || null,
    [planes, form.plan_id]
  );

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
    if (!form.plan_id) return setError('Selecciona un plan para comenzar.');

    await register({
      empresa: {
        razon_social: form.razon_social.trim(),
        rut_empresa: form.rut_empresa.trim(),
        sector: form.sector,
        email_contacto: form.email_contacto.trim(),
        telefono: form.telefono.trim(),
        direccion: form.direccion.trim(),
        ciudad: form.ciudad.trim(),
        plan_id: form.plan_id,
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
            Crea la cuenta de tu empresa, elige un plan y comienza a ordenar
            clientes, trabajadores y horarios. Sin tarjeta para empezar.
          </p>

          <div className="login-benefits">
            <div>
              <CheckCircle2 size={17} />
              <span><strong>Prueba completa:</strong> 15 días con acceso a toda la operación.</span>
            </div>
            <div>
              <CheckCircle2 size={17} />
              <span><strong>Pago simple:</strong> al confirmar el pago, la empresa queda activa.</span>
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
                <small>Datos, administrador y plan.</small>
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
            La prueba de 15 días comienza al registrarte. Al finalizar, tu
            empresa queda activa cuando TURNSOFT verifica el pago.
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

          <div className="login-section">
            <div className="login-section-head">
              <span className="login-section-icon"><CreditCard size={16} /></span>
              <div>
                <strong>Plan para tu empresa</strong>
                <small>La prueba es gratuita. El pago se verifica al finalizar.</small>
              </div>
            </div>

            {loadingPlans ? (
              <div className="register-plans-state">Cargando planes disponibles…</div>
            ) : plansError ? (
              <div className="form-error">{plansError}</div>
            ) : planes.length ? (
              <div className="register-plan-grid">
                {planes.map((plan) => {
                  const selected = plan.id === form.plan_id;
                  return (
                    <label key={plan.id} className={`register-plan ${selected ? 'is-selected' : ''}`}>
                      <input
                        type="radio"
                        name="plan"
                        value={plan.id}
                        checked={selected}
                        onChange={() => set('plan_id', plan.id)}
                      />
                      <div className="register-plan-head">
                        <strong>{plan.nombre}</strong>
                        {selected ? <span className="register-plan-check"><Check size={14} /></span> : null}
                      </div>
                      <div className="register-plan-price">
                        <strong>{money(plan.precio_mensual)}</strong>
                        <span>por mes</span>
                      </div>
                      {plan.descripcion ? <p>{plan.descripcion}</p> : null}
                      <ul>
                        <li><Building2 size={13} /> {limitLabel(plan.max_clientes, 'cliente', 'clientes')}</li>
                        <li><UserRound size={13} /> {limitLabel(plan.max_usuarios, 'usuario', 'usuarios')}</li>
                        <li><ShieldCheck size={13} /> {limitLabel(plan.max_guardias, 'trabajador', 'trabajadores')}</li>
                      </ul>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="register-empty">
                <Headphones size={20} />
                <div>
                  <strong>Aún no hay planes publicados</strong>
                  <p>
                    El supervisor de TURNSOFT todavía no habilitó el catálogo.
                    Vuelve a intentarlo más tarde o escríbenos para coordinar tu alta.
                  </p>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-md login-submit"
            disabled={busy || loadingPlans || !planes.length}
          >
            <span>{busy ? 'Creando tu empresa…' : 'Crear empresa y probar 15 días'}</span>
            <ArrowRight size={17} />
          </button>

          {selectedPlan ? (
            <div className="register-summary">
              <Sparkles size={15} />
              <span>
                Prueba de 15 días en el plan <strong>{selectedPlan.nombre}</strong>.
                Al finalizar, el acceso se activa con la verificación del pago.
              </span>
            </div>
          ) : null}

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
