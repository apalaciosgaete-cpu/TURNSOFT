import { useState } from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { DEMO_PASSWORD, getDemoAccounts } from '@shared/tenants.js';
import { useAuth } from '../store/AuthContext.jsx';

const ACCOUNTS = getDemoAccounts();
const OPERATOR_ACCOUNT = ACCOUNTS.find((account) => account.role === 'operador');
const CLIENT_ACCOUNTS = ACCOUNTS.filter((account) => account.role === 'cliente');

export function LoginScreen() {
  const { login, authError, clearAuthError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = (event) => {
    event.preventDefault();
    login(email, password);
  };

  const quickLogin = (account) => {
    clearAuthError();
    setEmail(account.email);
    setPassword(account.password);
    login(account.email, account.password);
  };

  const fillAccount = (account) => {
    clearAuthError();
    setEmail(account.email);
    setPassword(account.password);
  };

  return (
    <div className="login-shell">
      <section className="login-story">
        <div className="login-brand">
          <div className="login-brand-mark">TS</div>
          <div>
            <strong>TURNSOFT</strong>
            <span>Turnos legales para Chile</span>
          </div>
        </div>

        <div className="login-story-copy">
          <span className="login-eyebrow">
            <ShieldCheck size={15} /> Operación multi-cliente
          </span>
          <h1>Cada cliente, una cuenta.<br />Cada cuenta, sus propios datos.</h1>
          <p>
            Vigo Seguridad administra ocho operaciones desde un solo lugar.
            Los usuarios de cada cliente entran únicamente a su propia cuenta:
            no ven otras sucursales, otros horarios ni otra dotación.
          </p>

          <div className="login-benefits">
            <div>
              <CheckCircle2 size={17} />
              <span><strong>Operador:</strong> ve y administra sus ocho clientes.</span>
            </div>
            <div>
              <CheckCircle2 size={17} />
              <span><strong>Cliente:</strong> solo ve su operación y su cuenta.</span>
            </div>
            <div>
              <CheckCircle2 size={17} />
              <span><strong>Aislamiento:</strong> el backend refuerza el alcance con JWT.</span>
            </div>
          </div>

          <div className="login-sector-strip">
            <span>Seguridad</span>
            <span>Salud</span>
            <span>Minería</span>
            <span>Retail</span>
            <span>Logística</span>
          </div>
        </div>

        <div className="login-story-foot">
          <LockKeyhole size={15} />
          <span>Jornada ordinaria 42 h · reducción a 40 h desde el 26-04-2028</span>
        </div>
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <span className="login-card-eyebrow">Acceso demo</span>
          <h2>Inicia sesión</h2>
          <p className="login-card-sub">
            Usa una cuenta de ejemplo para recorrer la operación de Vigo Seguridad.
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
                placeholder="operador@vigoseguridad.cl"
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
                placeholder="demo1234"
              />
            </div>
          </label>

          <button type="submit" className="btn btn-primary btn-md login-submit">
            <span>Entrar a TURNSOFT</span>
            <ArrowRight size={17} />
          </button>

          <div className="login-hint">
            <Sparkles size={14} />
            <span>Clave demo para todas las cuentas: <strong>{DEMO_PASSWORD}</strong></span>
          </div>
        </form>

        <div className="login-accounts">
          <div className="login-accounts-head">
            <span>Acceso rápido</span>
            <small>Elige una cuenta para entrar sin escribir la clave</small>
          </div>

          <button
            type="button"
            className="login-operator-card"
            onClick={() => quickLogin(OPERATOR_ACCOUNT)}
          >
            <span className="login-operator-icon"><ShieldCheck size={20} /></span>
            <span className="login-operator-copy">
              <strong>Entrar como operador</strong>
              <small>Vigo Seguridad · administra los 8 clientes</small>
            </span>
            <ArrowRight size={17} />
          </button>

          <div className="login-client-grid">
            {CLIENT_ACCOUNTS.map((account, index) => (
              <button
                key={account.id}
                type="button"
                className="login-client-chip"
                onClick={() => quickLogin(account)}
                title={account.email}
              >
                <span className="login-client-index">Cliente {index + 1}</span>
                <span className="login-client-name">
                  <Building2 size={13} />
                  {account.clientName}
                </span>
                <span className="login-client-action">Entrar <ArrowRight size={12} /></span>
              </button>
            ))}
          </div>

          <p className="login-isolation-note">
            <LockKeyhole size={14} />
            Cada cuenta cliente está aislada: no puede consultar ni modificar datos de otra cuenta.
          </p>
        </div>
      </section>
    </div>
  );
}
