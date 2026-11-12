import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Mail,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import { SECTOR_META } from '@shared/legal.js';
import { useAuth } from '../store/AuthContext.jsx';
import { useTurnsoft } from '../store/TurnsoftContext.jsx';
import { ClientModal } from '../components/ClientModal.jsx';
import { ScenarioModal } from '../components/ScenarioModal.jsx';
import { Badge, Button, Card, SectorIcon, Stat } from '../components/ui.jsx';

export default function Clients() {
  const { isOperator, activeClientId, selectClient, session } = useAuth();
  const { clientSummaries, notify } = useTurnsoft();
  const navigate = useNavigate();
  const [modalClientId, setModalClientId] = useState(null);
  const [clientOpen, setClientOpen] = useState(false);

  const handleClientCreated = (client) => {
    notify(`Cliente ${client.nombre} creado. Ya puedes crear su primer escenario.`, 'success');
  };

  const totals = useMemo(
    () => ({
      clients: clientSummaries.length,
      scenarios: clientSummaries.reduce((sum, client) => sum + client.scenarioCount, 0),
      scheduled: clientSummaries.reduce((sum, client) => sum + client.scheduledCount, 0),
    }),
    [clientSummaries]
  );

  const openOperation = (clientId) => {
    selectClient(clientId);
    navigate('/');
  };

  const createScenario = (clientId) => {
    selectClient(clientId);
    setModalClientId(clientId);
  };

  return (
    <div className="page">
      <section className="clients-hero">
        <div className="clients-hero-copy">
          <span className="login-eyebrow">
            <ShieldCheck size={15} />
            {isOperator ? 'Operación multi-cliente' : 'Cuenta aislada'}
          </span>
          <h2>
            {isOperator
              ? 'Tus clientes, cada uno en su propia cuenta'
              : 'Tu cuenta y tu operación'}
          </h2>
          <p>
            {isOperator
              ? 'Como operador puedes entrar a la operación de cada cliente y administrar sus escenarios. Los usuarios de cada cuenta no ven a los demás.'
              : `${session?.name}, tu sesión está limitada a ${session?.clientName}. No tienes acceso a otras cuentas, sucursales ni horarios.`}
          </p>
        </div>
        <div className="clients-hero-side">
          <div className="clients-hero-badge">
            <Building2 size={22} />
            <div>
              <strong>{isOperator ? session?.empresa || 'Mi empresa' : session?.clientName}</strong>
              <span>{isOperator ? 'Cuenta operadora' : 'Cuenta cliente'}</span>
            </div>
          </div>
          {isOperator ? (
            <Button icon={Plus} onClick={() => setClientOpen(true)}>
              Nuevo cliente
            </Button>
          ) : null}
        </div>
      </section>

      <div className="stat-grid stat-grid-compact">
        <Stat
          label={isOperator ? 'Clientes' : 'Cuentas visibles'}
          value={totals.clients}
          hint={isOperator ? 'Bajo tu empresa operadora' : 'Solo tu propia cuenta'}
          icon={Building2}
        />
        <Stat
          label="Escenarios"
          value={totals.scenarios}
          hint="Disponibles en las cuentas visibles"
          icon={CalendarDays}
        />
        <Stat
          label="Con horario"
          value={totals.scheduled}
          hint="Escenarios generados o editados"
          icon={CheckCircle2}
          tone={totals.scheduled > 0 ? 'ok' : 'default'}
        />
      </div>

      {clientSummaries.length === 0 ? (
        <Card
          title="Aún no hay clientes"
          subtitle="Crea la primera cuenta para comenzar a planificar su operación."
        >
          <div className="empty">
            <span className="empty-icon"><Building2 size={22} /></span>
            <h3>Crea tu primer cliente</h3>
            <p>
              Cada cliente tiene su propia cuenta, dotación y escenarios. Podrás
              agregar más cuando quieras.
            </p>
            {isOperator ? (
              <div className="empty-action">
                <Button icon={Plus} onClick={() => setClientOpen(true)}>Nuevo cliente</Button>
              </div>
            ) : null}
          </div>
        </Card>
      ) : (
        <div className="client-grid">
        {clientSummaries.map((client) => {
          const meta = SECTOR_META[client.sector] || SECTOR_META.seguridad;
          const isActive = activeClientId === client.id;
          return (
            <article
              key={client.id}
              className={`client-card ${isActive ? 'is-active' : ''}`}
              style={{ '--sector-color': meta.accent, '--sector-tint': meta.tint }}
            >
              <header className="client-card-head">
                <SectorIcon sector={client.sector} meta={meta} size={19} />
                <div className="client-card-title">
                  <h3>{client.name}</h3>
                  <p>{client.legalName}</p>
                </div>
                <Badge tone={isActive ? 'ok' : 'neutral'} dot={isActive}>
                  {isActive ? 'Activo' : 'Aislado'}
                </Badge>
              </header>

              <div className="client-card-badges">
                <Badge tone="sector">
                  <SectorIcon sector={client.sector} meta={meta} size={12} />
                  {meta.short}
                </Badge>
                <Badge tone="info">{client.scenarioCount} escenario{client.scenarioCount === 1 ? '' : 's'}</Badge>
              </div>

              <dl className="client-card-details">
                <div>
                  <dt><UserRound size={13} /> Contacto</dt>
                  <dd>{client.contact || 'Sin contacto registrado'}</dd>
                </div>
                <div>
                  <dt><Mail size={13} /> Correo</dt>
                  <dd>{client.email || '—'}</dd>
                </div>
                <div>
                  <dt><Phone size={13} /> Teléfono</dt>
                  <dd>{client.phone || '—'}</dd>
                </div>
                <div>
                  <dt><MapPin size={13} /> Ubicación</dt>
                  <dd>{[client.address, client.city].filter(Boolean).join(', ') || '—'}</dd>
                </div>
              </dl>

              <div className="client-card-metrics">
                <div>
                  <span>Escenarios</span>
                  <strong>{client.scenarioCount}</strong>
                </div>
                <div>
                  <span>Con horario</span>
                  <strong>{client.scheduledCount}</strong>
                </div>
                <div>
                  <span>Último período</span>
                  <strong>{client.lastPeriod ? client.lastPeriod.replace(' · ', ' / ') : 'Sin datos'}</strong>
                </div>
              </div>

              <div className="client-card-actions">
                <Button variant="primary" size="sm" icon={ArrowRight} onClick={() => openOperation(client.id)}>
                  Ver operación
                </Button>
                <Button variant="ghost" size="sm" icon={Plus} onClick={() => createScenario(client.id)}>
                  Nuevo escenario
                </Button>
              </div>
            </article>
          );
        })}
        </div>
      )}

      {!isOperator ? (
        <Card title="Aislamiento de tu cuenta" subtitle="Así protege TURNSOFT los datos de cada cliente.">
          <div className="isolation-grid">
            <div>
              <ShieldCheck size={18} />
              <strong>Solo tu cliente</strong>
              <p>Tu sesión tiene un identificador de cliente fijo. El selector de otras cuentas no existe para tu rol.</p>
            </div>
            <div>
              <Users size={18} />
              <strong>Sin cruce de dotación</strong>
              <p>Los escenarios, trabajadores y horarios visibles pertenecen únicamente a {session?.clientName}.</p>
            </div>
            <div>
              <CalendarDays size={18} />
              <strong>Backend con JWT</strong>
              <p>Las rutas de la API vuelven a validar el cliente del token antes de leer o escribir datos.</p>
            </div>
          </div>
        </Card>
      ) : null}

      <ClientModal
        open={clientOpen}
        onClose={() => setClientOpen(false)}
        onCreated={handleClientCreated}
      />
      <ScenarioModal
        open={Boolean(modalClientId)}
        onClose={() => setModalClientId(null)}
        initialClientId={modalClientId}
      />
    </div>
  );
}
