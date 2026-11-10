import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Info,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  RotateCcw,
  Scale,
  ShieldAlert,
  Sparkles,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { SECTOR_META } from '@shared/legal.js';
import { formatRange } from '@shared/dates.js';
import { useAuth } from '../store/AuthContext.jsx';
import { useTurnsoft } from '../store/TurnsoftContext.jsx';
import { Badge, Button, SectorIcon } from './ui.jsx';
import { ScenarioModal } from './ScenarioModal.jsx';

const PAGE_META = {
  '/': { title: 'Panel de control', subtitle: 'Resumen operativo y cumplimiento del escenario activo.' },
  '/horario': { title: 'Horario', subtitle: 'Grilla editable por persona y día. Cada cambio se revalida al instante.' },
  '/personal': { title: 'Personal', subtitle: 'Dotación, contratos, disponibilidad y certificaciones.' },
  '/turnos': { title: 'Turnos', subtitle: 'Plantillas de turno, colación y cobertura por día de la semana.' },
  '/reglas': { title: 'Reglas de jornada', subtitle: 'Parámetros con los que TURNSOFT genera y valida el horario.' },
  '/reportes': { title: 'Reportes', subtitle: 'Métricas de cumplimiento, hallazgos y exportación.' },
  '/legal': { title: 'Base legal', subtitle: 'Fuentes, hitos de jornada y criterios aplicados en Chile.' },
  '/clientes': { title: 'Clientes', subtitle: 'Cuentas bajo la operación, aislamiento y acceso a cada servicio.' },
};

const NOTICE_ICONS = { success: CheckCircle2, error: AlertTriangle, info: Info };

export function Layout() {
  const {
    activeScenario,
    activeValidation,
    scenarios,
    activeScenarioId,
    selectScenario,
    generate,
    busyScenarioId,
    notice,
    dismissNotice,
    resetDemo,
  } = useTurnsoft();
  const {
    session,
    isOperator,
    clients,
    activeClient,
    activeClientId,
    selectClient,
    logout,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scenarioModal, setScenarioModal] = useState(false);

  const isClientAccount = location.pathname === '/clientes' && !isOperator;
  const meta = isClientAccount
    ? {
        title: 'Mi cuenta',
        subtitle: 'Tu operación aislada, tus escenarios y los datos de contacto de tu cuenta.',
      }
    : PAGE_META[location.pathname] || PAGE_META['/'];
  const sector = activeScenario ? SECTOR_META[activeScenario.sector] : null;
  const busy = busyScenarioId === activeScenario?.id;
  const errors = activeValidation?.metrics?.errors || 0;
  const warnings = activeValidation?.metrics?.warnings || 0;
  const NoticeIcon = notice ? NOTICE_ICONS[notice.tone] || Info : Info;

  const navGroups = [
    {
      label: 'Operación',
      items: [
        { to: '/', label: 'Panel', icon: LayoutDashboard, end: true },
        {
          to: '/clientes',
          label: isOperator ? 'Clientes' : 'Mi cuenta',
          icon: isOperator ? Building2 : UserRound,
        },
        { to: '/horario', label: 'Horario', icon: CalendarDays },
        { to: '/personal', label: 'Personal', icon: Users },
        { to: '/turnos', label: 'Turnos', icon: Clock3 },
      ],
    },
    {
      label: 'Cumplimiento',
      items: [
        { to: '/reglas', label: 'Reglas de jornada', icon: Scale },
        { to: '/reportes', label: 'Reportes', icon: BarChart3 },
        { to: '/legal', label: 'Base legal', icon: BookOpen },
      ],
    },
  ];

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    if (window.confirm('¿Cerrar sesión en TURNSOFT?')) {
      logout();
      navigate('/');
    }
  };

  return (
    <div
      className="app-shell"
      style={{
        '--accent': sector?.accent || '#0f766e',
        '--accent-tint': sector?.tint || '#e7f8f0',
      }}
    >
      <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">TS</div>
          <div className="brand-copy">
            <strong>TURNSOFT</strong>
            <span>Turnos legales para Chile</span>
          </div>
          <button type="button" className="sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú">
            <X size={20} />
          </button>
        </div>

        <div className="client-picker-box">
          <span className="scenario-picker-label">Cliente activo</span>
          {isOperator ? (
            <div className="scenario-select-row">
              <Building2 size={17} className="client-picker-icon" />
              <select
                className="scenario-select"
                value={activeClientId || ''}
                onChange={(event) => selectClient(event.target.value || null)}
                aria-label="Elegir cliente"
              >
                <option value="">Todos los clientes</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="client-static">
              <Building2 size={17} />
              <div>
                <strong>{activeClient?.name || session?.clientName}</strong>
                <span>{activeClient?.legalName}</span>
              </div>
            </div>
          )}
          {isOperator ? (
            <div className="scenario-picker-meta">
              <span>{activeClient ? activeClient.legalName : `${clients.length} clientes bajo tu operación`}</span>
              <span>{activeClient ? activeClient.city : 'Cada cuenta ve solo sus propios datos'}</span>
            </div>
          ) : (
            <div className="client-isolation-pill">
              <ShieldAlert size={13} />
              Cuenta aislada: solo tu operación
            </div>
          )}
        </div>

        <div className="scenario-picker-box">
          <span className="scenario-picker-label">Escenario activo</span>
          {scenarios.length ? (
            <>
              <div className="scenario-select-row">
                {sector ? <SectorIcon sector={activeScenario.sector} meta={sector} size={17} /> : null}
                <select
                  className="scenario-select"
                  value={activeScenarioId}
                  onChange={(event) => selectScenario(event.target.value)}
                  aria-label="Elegir escenario"
                >
                  {scenarios.map((scenario) => (
                    <option key={scenario.id} value={scenario.id}>
                      {SECTOR_META[scenario.sector]?.short || scenario.sector} · {scenario.name}
                    </option>
                  ))}
                </select>
              </div>
              {activeScenario ? (
                <div className="scenario-picker-meta">
                  <span>{activeScenario.company}</span>
                  <span>{formatRange(activeScenario.startDate, activeScenario.days)}</span>
                  {activeScenario.clientName ? <span>Cliente: {activeScenario.clientName}</span> : null}
                </div>
              ) : null}
            </>
          ) : (
            <div className="scenario-empty">
              No hay escenarios para esta cuenta. Crea el primero para comenzar.
            </div>
          )}
          <button type="button" className="scenario-add" onClick={() => setScenarioModal(true)}>
            <Plus size={15} /> Nuevo escenario
          </button>
        </div>

        <nav className="sidebar-nav">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <span className="nav-group-label">{group.label}</span>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}
                >
                  <item.icon size={18} strokeWidth={2} />
                  <span>{item.label}</span>
                  {item.to === '/reportes' && errors > 0 ? (
                    <span className="nav-count nav-count-danger">{errors}</span>
                  ) : null}
                  {item.to === '/reglas' && warnings > 0 && errors === 0 ? (
                    <span className="nav-count">{warnings}</span>
                  ) : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          {isOperator ? (
            <div className="sidebar-legal-card">
              <div className="sidebar-legal-top">
                <ShieldAlert size={16} />
                <strong>Jornada vigente: 42 h</strong>
              </div>
              <p>Baja a 40 h el 26-04-2028. Los turnos de 12 h requieren régimen excepcional autorizado.</p>
            </div>
          ) : (
            <div className="sidebar-legal-card">
              <div className="sidebar-legal-top">
                <ShieldAlert size={16} />
                <strong>Acceso restringido</strong>
              </div>
              <p>Tu sesión solo puede consultar y editar los datos de {activeClient?.name || 'tu cliente'}.</p>
            </div>
          )}

          {isOperator ? (
            <button
              type="button"
              className="sidebar-reset"
              onClick={() => {
                if (window.confirm('¿Restaurar los escenarios demo de los ocho clientes? Se perderán los cambios locales.')) {
                  resetDemo();
                }
              }}
            >
              <RotateCcw size={14} /> Restaurar datos demo
            </button>
          ) : null}

          <div className="sidebar-account">
            <span className="account-avatar">{session?.initials || 'TS'}</span>
            <div className="account-copy">
              <strong>{session?.name}</strong>
              <span>
                {isOperator
                  ? 'Operador · Vigo Seguridad'
                  : `Cliente · ${activeClient?.name || session?.clientName}`}
              </span>
            </div>
            <button
              type="button"
              className="account-logout"
              onClick={handleLogout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {mobileOpen ? <button type="button" className="sidebar-scrim" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú" /> : null}

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="menu-btn" onClick={() => setMobileOpen(true)} aria-label="Abrir menú">
              <Menu size={20} />
            </button>
            <div>
              <div className="topbar-eyebrow">
                <Badge tone="info" className="client-badge">
                  <Building2 size={13} />
                  {activeClient?.name || (isOperator ? 'Todos los clientes' : session?.clientName)}
                </Badge>
                {sector ? (
                  <Badge tone="sector" className="sector-badge">
                    <SectorIcon sector={activeScenario.sector} meta={sector} size={13} />
                    {sector.short}
                  </Badge>
                ) : null}
                {activeScenario ? <span>{formatRange(activeScenario.startDate, activeScenario.days)}</span> : null}
                {activeScenario?.schedule ? (
                  <Badge tone={errors > 0 ? 'danger' : warnings > 0 ? 'warn' : 'ok'} dot>
                    {errors > 0 ? `${errors} error${errors === 1 ? '' : 'es'}` : warnings > 0 ? `${warnings} advertencia${warnings === 1 ? '' : 's'}` : 'Cumplimiento OK'}
                  </Badge>
                ) : (
                  <Badge tone="neutral" dot>Sin horario</Badge>
                )}
              </div>
              <h1 className="topbar-title">{meta.title}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <span className="topbar-sub">{meta.subtitle}</span>
            <Button
              variant="primary"
              icon={busy ? RefreshCw : Sparkles}
              onClick={() => generate(activeScenarioId)}
              disabled={busy || !activeScenario}
              className={busy ? 'is-busy' : ''}
            >
              {busy ? 'Generando…' : activeScenario?.schedule ? 'Regenerar horario' : 'Generar horario'}
            </Button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>

        <footer className="app-footer">
          <span>TURNSOFT · {new Date().getFullYear()} · Herramienta de apoyo a la planificación, no constituye asesoría legal.</span>
          <span>Jornada ordinaria 42 h · próxima reducción 40 h el 26-04-2028</span>
        </footer>
      </div>

      <ScenarioModal open={scenarioModal} onClose={() => setScenarioModal(false)} />

      {notice ? (
        <div className={`toast toast-${notice.tone}`} key={notice.id} role="status">
          <NoticeIcon size={19} />
          <span>{notice.message}</span>
          <button type="button" onClick={dismissNotice} aria-label="Cerrar aviso">
            <X size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
