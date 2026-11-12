import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  CreditCard,
  Headphones,
  Inbox,
  MessageSquare,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { apiRequest, useAuth } from '../store/AuthContext.jsx';
import { useTurnsoft } from '../store/TurnsoftContext.jsx';
import { dateLabel, relativeTime } from '../lib/format.js';
import { Badge, Button, Card, EmptyState, Modal, Stat } from '../components/ui.jsx';
import { SupportTicketModal } from '../components/SupportTicketModal.jsx';

const PRIORITY_TONE = { urgente: 'danger', alta: 'warn', normal: 'info', baja: 'neutral' };
const STATUS_TONE = { abierto: 'warn', en_revision: 'info', resuelto: 'ok', cerrado: 'neutral' };
const STATUS_LABEL = {
  abierto: 'Abierto',
  en_revision: 'En revisión',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
};

export default function Support() {
  const { token } = useAuth();
  const { notify } = useTurnsoft();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest('/soporte', { token });
      setTickets(Array.isArray(data) ? data : []);
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => ({
      abiertos: tickets.filter((ticket) => ['abierto', 'en_revision'].includes(ticket.estado)).length,
      resueltos: tickets.filter((ticket) => ['resuelto', 'cerrado'].includes(ticket.estado)).length,
      sinVer: tickets.filter((ticket) => ticket.respuesta && !ticket.visto_cliente).length,
    }),
    [tickets]
  );

  const create = async (payload) => {
    const created = await apiRequest('/soporte', { method: 'POST', token, body: payload });
    setTickets((previous) => [created, ...previous]);
    notify('Ticket enviado. El supervisor maestro lo revisará a la brevedad.');
  };

  const openTicket = async (ticket) => {
    setSelected(ticket);
    if (ticket.respuesta && !ticket.visto_cliente) {
      try {
        const updated = await apiRequest(`/soporte/${ticket.id}/visto`, { method: 'PATCH', token });
        setTickets((previous) =>
          previous.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
        );
        setSelected((previous) => (previous ? { ...previous, ...updated } : previous));
      } catch {
        // Si falla, el ticket sigue visible; solo no se marca como leído.
      }
    }
  };

  return (
    <div className="page support-page">
      <section className="support-hero">
        <div>
          <span className="support-eyebrow"><Headphones size={15} /> Soporte TURNSOFT</span>
          <h2>Estamos para ayudarte a operar sin fricción.</h2>
          <p>
            Envía consultas sobre planes, pagos o problemas técnicos. El supervisor
            maestro responde por este canal y solo tu empresa ve el historial.
          </p>
        </div>
        <div className="support-hero-actions">
          <Button icon={Plus} onClick={() => setCreateOpen(true)}>Nuevo ticket</Button>
          <span className="support-sla">
            <Clock3 size={15} /> Respuesta manual en horario hábil
          </span>
        </div>
      </section>

      <div className="stat-grid support-stat-grid">
        <Stat
          label="Tickets activos"
          value={counts.abiertos}
          hint="Abiertos o en revisión"
          icon={Inbox}
          tone={counts.abiertos ? 'warn' : 'default'}
        />
        <Stat
          label="Respuestas nuevas"
          value={counts.sinVer}
          hint="Sin leer en tu bandeja"
          icon={MessageSquare}
          tone={counts.sinVer ? 'info' : 'default'}
        />
        <Stat
          label="Resueltos"
          value={counts.resueltos}
          hint="Historial de tu empresa"
          icon={CheckCircle2}
          tone="ok"
        />
      </div>

      {error ? (
        <div className="master-inline-error">
          <AlertTriangle size={17} />
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={load}>Reintentar</Button>
        </div>
      ) : null}

      <Card
        title="Mis tickets"
        subtitle="Solo tu empresa puede ver estas conversaciones."
        actions={<Badge tone="info">{tickets.length} en total</Badge>}
        noPadding
      >
        {loading ? (
          <div className="master-loading is-compact">
            <span className="master-loading-ring" />
            <div><strong>Cargando tickets…</strong></div>
          </div>
        ) : tickets.length ? (
          <ul className="master-ticket-list">
            {tickets.map((ticket) => (
              <li key={ticket.id} className={`master-ticket-row ${ticket.respuesta && !ticket.visto_cliente ? 'has-news' : ''}`}>
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
                      {STATUS_LABEL[ticket.estado] || ticket.estado}
                    </Badge>
                    {ticket.respuesta && !ticket.visto_cliente ? (
                      <Badge tone="info" dot>Respuesta nueva</Badge>
                    ) : null}
                  </div>
                  <p>{ticket.mensaje.length > 170 ? `${ticket.mensaje.slice(0, 170)}…` : ticket.mensaje}</p>
                  <div className="master-ticket-meta-line">
                    <span>{ticket.categoria}</span>
                    <span>{relativeTime(ticket.creado_en)}</span>
                    {ticket.respuesta ? <span>Respondido {relativeTime(ticket.respondido_en)}</span> : null}
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => openTicket(ticket)}>
                  {ticket.respuesta ? 'Ver respuesta' : 'Ver ticket'}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Headphones}
            title="Aún no has abierto tickets"
            description="Si necesitas ampliar tu plan, regularizar un pago o reportar un problema, escríbenos."
            action={<Button icon={Plus} onClick={() => setCreateOpen(true)}>Crear primer ticket</Button>}
          />
        )}
      </Card>

      <div className="master-note-grid support-note-grid">
        <div className="master-note">
          <ShieldCheck size={18} />
          <div>
            <strong>Privado por empresa</strong>
            <span>Cada ticket queda asociado a tu empresa. Ninguna otra cuenta puede verlo.</span>
          </div>
        </div>
        <div className="master-note">
          <CreditCard size={18} />
          <div>
            <strong>Pagos y planes</strong>
            <span>Puedes pedir ampliar cupos o regularizar una mensualidad desde un ticket.</span>
          </div>
        </div>
        <div className="master-note">
          <Clock3 size={18} />
          <div>
            <strong>Seguimiento</strong>
            <span>Cuando el supervisor responda, verás la respuesta y el estado actualizado aquí.</span>
          </div>
        </div>
      </div>

      <SupportTicketModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={create}
      />

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.asunto || 'Ticket'}
        subtitle={selected ? `${STATUS_LABEL[selected.estado] || selected.estado} · ${dateLabel(selected.creado_en, { withTime: true })}` : ''}
        footer={<Button variant="secondary" onClick={() => setSelected(null)}>Cerrar</Button>}
      >
        {selected ? (
          <div className="support-thread">
            <div className="master-ticket-meta field-full">
              <div>
                <span>Categoría</span>
                <strong className="master-capitalize">{selected.categoria}</strong>
              </div>
              <div>
                <span>Prioridad</span>
                <Badge tone={PRIORITY_TONE[selected.prioridad] || 'neutral'}>{selected.prioridad}</Badge>
              </div>
              <div>
                <span>Estado</span>
                <Badge tone={STATUS_TONE[selected.estado] || 'neutral'}>
                  {STATUS_LABEL[selected.estado] || selected.estado}
                </Badge>
              </div>
            </div>

            <div className="support-message">
              <span>Tu mensaje</span>
              <p>{selected.mensaje}</p>
            </div>

            {selected.respuesta ? (
              <div className="support-response">
                <span>
                  <Headphones size={15} /> Respuesta de TURNSOFT
                  {selected.respondido_en ? ` · ${dateLabel(selected.respondido_en, { withTime: true })}` : ''}
                </span>
                <p>{selected.respuesta}</p>
              </div>
            ) : (
              <div className="support-pending">
                <Clock3 size={16} />
                <span>Tu ticket está en la bandeja del supervisor maestro. Te responderemos por aquí.</span>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
