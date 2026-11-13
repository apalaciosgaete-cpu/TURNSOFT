import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  CreditCard,
  Headphones,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../store/AuthContext.jsx';
import { useMaster } from '../store/MasterContext.jsx';
import { Badge, Button } from './ui.jsx';
import { BrandMark } from './Brand.jsx';

const PAGE_META = {
  '/master': {
    title: 'Resumen general',
    subtitle: 'Estado de la plataforma, cobros pendientes y soporte.',
  },
  '/master/empresas': {
    title: 'Empresas',
    subtitle: 'Empresas registradas, prueba de 15 días, plan y ocupación.',
  },
  '/master/pagos': {
    title: 'Pagos',
    subtitle: 'Registro y verificación manual de mensualidades.',
  },
  '/master/planes': {
    title: 'Planes',
    subtitle: 'Precios y límites de clientes, usuarios y guardias.',
  },
  '/master/soporte': {
    title: 'Soporte',
    subtitle: 'Tickets enviados por las empresas y respuestas del supervisor.',
  },
};

const NAV = [
  { to: '/master', label: 'Resumen', icon: LayoutDashboard, end: true },
  { to: '/master/empresas', label: 'Empresas', icon: Building2 },
  { to: '/master/pagos', label: 'Pagos', icon: CreditCard },
  { to: '/master/planes', label: 'Planes', icon: ShieldCheck },
  { to: '/master/soporte', label: 'Soporte', icon: Headphones },
];

export function MasterLayout() {
  const { session, logout } = useAuth();
  const { resumen, loading, refresh, notice, dismissNotice } = useMaster();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const meta = PAGE_META[location.pathname] || PAGE_META['/master'];

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const pendingPayments = Number(resumen?.pagos_pendientes || 0);
  const overdue = Number(resumen?.pagos_vencidos || 0);
  const openTickets = Number(resumen?.tickets_abiertos || 0);
  const trialsEnding = Number(resumen?.pruebas_por_vencer || 0);

  const handleLogout = () => {
    if (window.confirm('¿Cerrar sesión en la consola maestra?')) {
      logout();
      navigate('/');
    }
  };

  return (
    <div className="app-shell master-shell">
      <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <div className="sidebar-brand">
          <BrandMark size={42} className="brand-mark" />
          <div className="brand-copy">
            <strong>TURNSOFT</strong>
            <span>Turnos para Chile</span>
          </div>
          <button
            type="button"
            className="sidebar-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        <div className="master-badge-box">
          <span className="master-badge-icon"><ShieldCheck size={17} /></span>
          <div>
            <strong>Supervisor maestro</strong>
            <span>Acceso global a la plataforma</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-group">
            <span className="nav-group-label">Consola maestra</span>
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}
              >
                <item.icon size={18} strokeWidth={2} />
                <span>{item.label}</span>
                {item.to === '/master/pagos' && overdue > 0 ? (
                  <span className="nav-count nav-count-danger">{overdue}</span>
                ) : item.to === '/master/pagos' && pendingPayments > 0 ? (
                  <span className="nav-count">{pendingPayments}</span>
                ) : null}
                {item.to === '/master/soporte' && openTickets > 0 ? (
                  <span className="nav-count">{openTickets}</span>
                ) : null}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-legal-card">
            <div className="sidebar-legal-top">
              <ShieldCheck size={16} />
              <strong>Rol global</strong>
            </div>
            <p>
              Esta cuenta no pertenece a una empresa. Supervisa la ocupación,
              los pagos, los planes y el soporte de toda la plataforma. Las
              empresas se registran desde la página pública.
            </p>
          </div>

          <div className="sidebar-account">
            <span className="account-avatar">{session?.initials || 'TS'}</span>
            <div className="account-copy">
              <strong>{session?.name}</strong>
              <span>Supervisor maestro</span>
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

      {mobileOpen ? (
        <button
          type="button"
          className="sidebar-scrim"
          onClick={() => setMobileOpen(false)}
          aria-label="Cerrar menú"
        />
      ) : null}

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="menu-btn"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu size={20} />
            </button>
            <div>
              <div className="topbar-eyebrow">
                <Badge tone="info" className="client-badge">
                  <ShieldCheck size={13} />
                  Consola maestra
                </Badge>
                {overdue > 0 ? (
                  <Badge tone="danger" dot>
                    {overdue} pago{overdue === 1 ? '' : 's'} vencido{overdue === 1 ? '' : 's'}
                  </Badge>
                ) : (
                  <Badge tone="ok" dot>Sin pagos vencidos</Badge>
                )}
                {openTickets > 0 ? (
                  <Badge tone="warn">
                    {openTickets} ticket{openTickets === 1 ? '' : 's'} abierto{openTickets === 1 ? '' : 's'}
                  </Badge>
                ) : null}
                {trialsEnding > 0 ? (
                  <Badge tone="warn" dot>
                    {trialsEnding} prueba{trialsEnding === 1 ? '' : 's'} por vencer
                  </Badge>
                ) : null}
              </div>
              <h1 className="topbar-title">{meta.title}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <span className="topbar-sub">{meta.subtitle}</span>
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={() => refresh()}
              disabled={loading}
              className={loading ? 'is-busy' : ''}
            >
              {loading ? 'Actualizando…' : 'Actualizar'}
            </Button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>

        <footer className="app-footer">
          <span>
            TURNSOFT · {new Date().getFullYear()} · Supervisión de ocupación, pagos y soporte
          </span>
          <span>Alta pública de empresas · prueba de 15 días</span>
        </footer>
      </div>

      {notice ? (
        <div className={`toast toast-${notice.tone}`} key={notice.id} role="status">
          <ShieldCheck size={19} />
          <span>{notice.message}</span>
          <button type="button" onClick={dismissNotice} aria-label="Cerrar aviso">
            <X size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
