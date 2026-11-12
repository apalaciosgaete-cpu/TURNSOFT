import { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Headphones,
  Inbox,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { useMaster } from '../store/MasterContext.jsx';
import { dateLabel, relativeTime } from '../lib/format.js';
import { Badge, Button, Card, EmptyState, Stat } from '../components/ui.jsx';
import { MasterTicketModal } from '../components/MasterTicketModal.jsx';

const FILTERS = [
  { id: 'abiertos', label: 'Abiertos' },
  { id: 'todos', label: 'Todos' },
  { id: 'abierto', label: 'Abierto' },
  { id: 'en_revision', label: 'En revisión' },
  { id: 'resuelto', label: 'Resueltos' },
  { id: 'cerrado', label: 'Cerrados' },
];

const PRIORITY_TONE = { urgente: 'danger', alta: 'warn', normal: 'info', baja: 'neutral' };
const STATUS_TONE = { abierto: 'warn', en_revision: 'info', resuelto: 'ok', cerrado: 'neutral' };

export default function MasterSupport() {
  const { tickets, loading, error, refresh } = useMaster();
  const [filter, setFilter] = useState('abiertos');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);

  const counts = useMemo(
    () => ({
      abiertos: tickets.filter((ticket) => ticket.estado === 'abierto').length,
      revision: tickets.filter((ticket) => ticket.estado === 'en_revision').length,
      resueltos: tickets.filter((ticket) => ticket.estado === 'resuelto').length,
    }),
    [tickets]
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (filter === 'abiertos' && !['abierto', 'en_revision'].includes(ticket.estado)) return false;
      if (filter !== 'todos' && filter !== 'abiertos' && ticket.estado !== filter) return false;
      if (!term) return true;
      return [ticket.asunto, ticket.razon_social, ticket.usuario_email, ticket.usuario_nombre]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [tickets, filter, query]);

  return (
    <div className="page master-page">
      <div className="stat-grid master-stat-grid">
        <Stat
          label="Abiertos"
          value={counts.abiertos}
          hint="Sin primera respuesta"
          icon={Inbox}
          tone={counts.abiertos ? 'warn' : 'default'}
        />
        <Stat
          label="En revisión"
          value={counts.revision}
          hint="El supervisor está trabajando"
          icon={Clock3}
          tone={counts.revision ? 'info' : 'default'}
        />
        <Stat
          label="Resueltos"
          value={counts.resueltos}
          hint="Respuesta enviada a la empresa"
          icon={CheckCircle2}
          tone="ok"
        />
        <Stat
          label="Total recibidos"
          value={tickets.length}
          hint="Historial de soporte"
          icon={Headphones}
        />
      </div>

      <div className="master-toolbar">
        <div className="master-toolbar-filters">
          <label className="master-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por empresa, asunto o solicitante"
            />
          </label>
          <div className="master-segmented master-segmented-wrap" role="group" aria-label="Filtrar tickets">
            {FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={filter === option.id ? 'is-active' : ''}
                onClick={() => setFilter(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <Button variant="secondary" icon={RefreshCw} onClick={() => refresh()}>
          Actualizar bandeja
        </Button>
      </div>

      {error ? (
        <div className="master-inline-error">
          <ShieldAlert size={17} />
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={() => refresh()}>Reintentar</Button>
        </div>
      ) : null}

      <Card
        title="Bandeja de soporte"
        subtitle="Cada respuesta queda visible para la empresa en su página Soporte."
        actions={<Badge tone="info">{filtered.length} tickets</Badge>}
        noPadding
      >
        {loading && !tickets.length ? (
          <div className="master-loading is-compact">
            <span className="master-loading-ring" />
            <div><strong>Cargando tickets…</strong></div>
          </div>
        ) : filtered.length ? (
          <ul className="master-ticket-list">
            {filtered.map((ticket) => (
              <li key={ticket.id} className="master-ticket-row">
                <span
                  className={`master-ticket-priority ${
                    ticket.prioridad === 'urgente'
                      ? 'is-danger'
                      : ticket.prioridad === 'alta'
                        ? 'is-warn'
                        : 'is-info'
                  }`}
                >
                  <MessageSquare size={18} />
                </span>
                <div className="master-ticket-main">
                  <div className="master-ticket-head">
                    <strong>{ticket.asunto}</strong>
                    <Badge tone={PRIORITY_TONE[ticket.prioridad] || 'neutral'}>{ticket.prioridad}</Badge>
                    <Badge tone={STATUS_TONE[ticket.estado] || 'neutral'} dot>
                      {ticket.estado.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p>{ticket.mensaje.length > 180 ? `${ticket.mensaje.slice(0, 180)}…` : ticket.mensaje}</p>
                  <div className="master-ticket-meta-line">
                    <span>{ticket.razon_social}</span>
                    <span>{ticket.usuario_nombre || ticket.usuario_email || 'Usuario'}</span>
                    <span>{ticket.categoria}</span>
                    <span title={dateLabel(ticket.creado_en, { withTime: true })}>
                      {relativeTime(ticket.creado_en)}
                    </span>
                  </div>
                  {ticket.respuesta ? (
                    <div className="master-ticket-inline-reply">
                      <CheckCircle2 size={14} />
                      <span>Respondido · {relativeTime(ticket.respondido_en)}</span>
                    </div>
                  ) : null}
                </div>
                <Button
                  variant={ticket.estado === 'abierto' ? 'primary' : 'secondary'}
                  size="sm"
                  iconRight={ArrowRight}
                  onClick={() => setSelected(ticket)}
                >
                  {ticket.estado === 'abierto' ? 'Responder' : 'Ver ticket'}
                </Button>
              </li>
            ))}
          </ul>
        ) : tickets.length ? (
          <EmptyState
            icon={Search}
            title="Sin tickets en este filtro"
            description="Cambia el estado seleccionado o busca por empresa."
          />
        ) : (
          <EmptyState
            icon={Headphones}
            title="Sin solicitudes de soporte"
            description="Cuando una empresa abra un ticket desde su cuenta, aparecerá aquí."
          />
        )}
      </Card>

      <MasterTicketModal
        open={Boolean(selected)}
        ticket={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
