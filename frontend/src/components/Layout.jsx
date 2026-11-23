import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  CalendarDays,
  CalendarRange,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Contact,
  Headphones,
  ImagePlus,
  Info,
  LayoutDashboard,
  UserCog,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
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
import { trialDaysLeft } from '../lib/format.js';
import { Badge, Button, EmptyState } from './ui.jsx';
import { BrandMark } from './Brand.jsx';
import { CompanyMark, useCompanyLogo } from './CompanyMark.jsx';
import { ScenarioModal } from './ScenarioModal.jsx';

const PAGE_META = {
  '/': { title: 'Panel de control', subtitle: 'Resumen operativo y cumplimiento de la planificación activa.' },
  '/horario': { title: 'Horario', subtitle: 'Grilla editable por persona y día. Cada cambio se revalida al instante.' },
  '/personal': { title: 'Dotación', subtitle: 'Personas de esta planificación: contratos, disponibilidad y certificaciones.' },
  '/turnos': { title: 'Turnos', subtitle: 'Plantillas de turno, colación y cobertura por día de la semana.' },
  '/reglas': { title: 'Reglas de jornada', subtitle: 'Parámetros con los que TURNSOFT genera y valida el horario.' },
  '/reportes': { title: 'Reportes', subtitle: 'Métricas de cumplimiento, hallazgos y exportación.' },
  '/legal': { title: 'Base legal', subtitle: 'Fuentes, hitos de jornada y criterios aplicados en Chile.' },
  '/clientes': { title: 'Clientes', subtitle: 'Solo si prestas servicio a otras empresas: cada cliente tiene su operación aislada.' },
  '/usuarios': { title: 'Usuarios', subtitle: 'Asigna administradores y validadores de tu empresa.' },
  '/empresa': { title: 'Mi empresa', subtitle: 'Logo, datos de la empresa y horarios de entrada y salida.' },
  '/trabajadores': { title: 'Trabajadores', subtitle: 'Base de datos de trabajadores de tu empresa. Alimenta cada planificación.' },
  '/soporte': { title: 'Soporte', subtitle: 'Tickets, planes y comunicación directa con TURNSOFT.' },
};

// Páginas que dependen de la planificación activa.
const PLANNING_ROUTES = new Set(['/', '/horario', '/personal', '/turnos', '/reglas', '/reportes']);

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
  } = useTurnsoft();
  const companyLogo = useCompanyLogo();
  const {
    session,
    isOperator,
    readOnly,
    canManageUsers,
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
        subtitle: 'Tu operación aislada, tus planificaciones y los datos de contacto de tu cuenta.',
      }
    : PAGE_META[location.pathname] || PAGE_META['/'];
  const sector = activeScenario ? SECTOR_META[activeScenario.sector] : null;
  const busy = busyScenarioId === activeScenario?.id;
  const errors = activeValidation?.metrics?.errors || 0;
  const warnings = activeValidation?.metrics?.warnings || 0;
  const NoticeIcon = notice ? NOTICE_ICONS[notice.tone] || Info : Info;
  const trialDays = trialDaysLeft(session?.pruebaFin);
  const showTrial = isOperator && session?.empresaEstado === 'prueba' && location.pathname !== '/empresa';
  const isPlanningPage = PLANNING_ROUTES.has(location.pathname);
  const needsPlanning = isPlanningPage && location.pathname !== '/' && !activeScenario;
  const sectorLabel = SECTOR_META[session?.empresaSector]?.label || '';

  const navGroups = [
    {
      label: 'Operación',
      items: [
        { to: '/', label: 'Panel', icon: LayoutDashboard, end: true },
        ...(!isOperator ? [{ to: '/clientes', label: 'Mi cuenta', icon: UserRound }] : []),
        { to: '/horario', label: 'Horario', icon: CalendarDays },
        { to: '/personal', label: 'Dotación', icon: Users },
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
    ...(isOperator
      ? [
          {
            label: 'Administración',
            items: [
              { to: '/empresa', label: 'Mi empresa', icon: Building2 },
              { to: '/trabajadores', label: 'Trabajadores', icon: Contact },
              ...(canManageUsers
                ? [{ to: '/usuarios', label: 'Usuarios', icon: UserCog }]
                : []),
              { to: '/clientes', label: 'Clientes', icon: Briefcase },
            ],
          },
        ]
      : []),
    {
      label: 'Ayuda',
      items: [{ to: '/soporte', label: 'Soporte', icon: Headphones }],
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
        '--accent': sector?.accent || '#1d4ed8',
        '--accent-tint': sector?.tint || '#e8efff',
      }}
    >
      <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <div className="sidebar-brand">
          <BrandMark size={42} className="brand-mark" />
          <div className="brand-copy">
            <strong>TURNSOFT</strong>
            <span>Turnos para Chile</span>
          </div>
          <button type="button" className="sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú">
            <X size={20} />
          </button>
        </div>

        {isOperator ? (
          <div className="company-box">
            <div className="company-box-main">
              <button
                type="button"
                className="company-logo-btn"
                onClick={companyLogo.pick}
                disabled={!companyLogo.canEdit || companyLogo.busy}
                title={companyLogo.canEdit ? 'Cambiar el logo de la empresa' : undefined}
                aria-label={companyLogo.canEdit ? 'Cambiar el logo de la empresa' : 'Logo de la empresa'}
              >
                <CompanyMark name={session?.empresa} logo={session?.empresaLogo} size={46} />
                {companyLogo.canEdit ? (
                  <span className="company-logo-edit"><Camera size={12} /></span>
                ) : null}
              </button>
              <div className="company-box-copy">
                <span className="company-box-label">Tu empresa</span>
                <strong title={session?.empresa}>{session?.empresa}</strong>
                {sectorLabel ? <span>{sectorLabel}</span> : null}
              </div>
            </div>
            {companyLogo.canEdit && !session?.empresaLogo ? (
              <button type="button" className="company-logo-cta" onClick={companyLogo.pick} disabled={companyLogo.busy}>
                <ImagePlus size={14} /> {companyLogo.busy ? 'Subiendo…' : 'Subir logo de la empresa'}
              </button>
            ) : null}
            {clients.length > 0 ? (
              <label className="company-scope">
                <span>Ver la operación de</span>
                <select
                  className="scenario-select"
                  value={activeClientId || ''}
                  onChange={(event) => selectClient(event.target.value || null)}
                  aria-label="Elegir cliente"
                >
                  <option value="">Toda la empresa</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {companyLogo.input}
          </div>
        ) : (
          <div className="client-picker-box">
            <span className="scenario-picker-label">Cliente</span>
            <div className="client-static">
              <Building2 size={17} />
              <div>
                <strong>{activeClient?.name || session?.clientName}</strong>
                <span>{activeClient?.legalName}</span>
              </div>
            </div>
            <div className="client-isolation-pill">
              <ShieldAlert size={13} />
              Cuenta aislada: solo tu operación
            </div>
          </div>
        )}

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
          {readOnly ? (
            <div className="sidebar-legal-card">
              <div className="sidebar-legal-top">
                <ShieldAlert size={16} />
                <strong>Cuenta de validador</strong>
              </div>
              <p>Puedes consultar toda la operación y aprobar horarios y solicitudes. Los cambios los hace el administrador.</p>
            </div>
          ) : isOperator ? (
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

          <div className="sidebar-account">
            <span className="account-avatar">{session?.initials || 'TS'}</span>
            <div className="account-copy">
              <strong>{session?.name}</strong>
              <span>
                {isOperator
                  ? session?.rol === 'operador'
                    ? 'Acceso de la empresa'
                    : `${session?.rolLabel || 'Operador'} · ${session?.empresa || 'Mi empresa'}`
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
                {isPlanningPage && scenarios.length ? (
                  <div className="plan-switch">
                    <CalendarRange size={15} />
                    <select
                      value={activeScenarioId || ''}
                      onChange={(event) => selectScenario(event.target.value)}
                      aria-label="Elegir planificación"
                    >
                      {scenarios.map((scenario) => (
                        <option key={scenario.id} value={scenario.id}>
                          {scenario.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="plan-switch-caret" />
                    {readOnly ? null : (
                      <button
                        type="button"
                        className="plan-switch-add"
                        onClick={() => setScenarioModal(true)}
                        title="Nueva planificación"
                        aria-label="Nueva planificación"
                      >
                        <Plus size={14} />
                      </button>
                    )}
                  </div>
                ) : null}
                {activeClient || !isOperator ? (
                  <Badge tone="info" className="client-badge">
                    <Building2 size={13} />
                    {activeClient?.name || session?.clientName}
                  </Badge>
                ) : null}
                {isPlanningPage && activeScenario ? <span>{formatRange(activeScenario.startDate, activeScenario.days)}</span> : null}
                {isPlanningPage && activeScenario ? (
                  activeScenario.schedule ? (
                    <Badge tone={errors > 0 ? 'danger' : warnings > 0 ? 'warn' : 'ok'} dot>
                      {errors > 0 ? `${errors} error${errors === 1 ? '' : 'es'}` : warnings > 0 ? `${warnings} advertencia${warnings === 1 ? '' : 's'}` : 'Cumplimiento OK'}
                    </Badge>
                  ) : (
                    <Badge tone="neutral" dot>Sin horario</Badge>
                  )
                ) : null}
                {isPlanningPage && !activeScenario ? (
                  <Badge tone="neutral" dot>Sin planificación</Badge>
                ) : null}
              </div>
              <h1 className="topbar-title">{meta.title}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <span className="topbar-sub">{meta.subtitle}</span>
            {!isPlanningPage || readOnly ? null : activeScenario ? (
              <Button
                variant="primary"
                icon={busy ? RefreshCw : Sparkles}
                onClick={() => generate(activeScenarioId)}
                disabled={busy}
                className={busy ? 'is-busy' : ''}
              >
                {busy ? 'Generando…' : activeScenario.schedule ? 'Regenerar horario' : 'Generar horario'}
              </Button>
            ) : (
              <Button variant="primary" icon={Plus} onClick={() => setScenarioModal(true)}>
                Nueva planificación
              </Button>
            )}
          </div>
        </header>

        <main className="content">
          {showTrial ? (
            <div className={`trial-banner ${trialDays !== null && trialDays <= 5 ? 'is-urgent' : ''}`}>
              <span className="trial-banner-icon"><Sparkles size={18} /></span>
              <div className="trial-banner-copy">
                <strong>Prueba de 15 días · quedan {trialDays ?? 0} días</strong>
                <span>
                  {session?.planName ? `Plan ${session.planName}. ` : ''}
                  Al verificar el pago, tu empresa queda activa automáticamente.
                </span>
              </div>
              <Link className="trial-banner-link" to="/empresa">
                Revisar mi empresa <ArrowRight size={15} />
              </Link>
            </div>
          ) : null}
          {needsPlanning ? (
            <div className="page">
              <EmptyState
                icon={CalendarRange}
                title="Aún no tienes una planificación"
                description="Una planificación es el período que vas a programar, por ejemplo un mes, con su dotación y sus turnos. Créala para trabajar aquí."
                action={
                  readOnly ? null : (
                    <Button icon={Plus} onClick={() => setScenarioModal(true)}>
                      Crear planificación
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <Outlet />
          )}
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
