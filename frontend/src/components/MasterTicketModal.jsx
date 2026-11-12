import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { useMaster } from '../store/MasterContext.jsx';
import { dateLabel, relativeTime } from '../lib/format.js';
import { Badge, Button, Field, Modal } from './ui.jsx';

const PRIORIDADES = [
  { id: 'baja', label: 'Baja' },
  { id: 'normal', label: 'Normal' },
  { id: 'alta', label: 'Alta' },
  { id: 'urgente', label: 'Urgente' },
];

const ESTADOS = [
  { id: 'abierto', label: 'Abierto' },
  { id: 'en_revision', label: 'En revisión' },
  { id: 'resuelto', label: 'Resuelto' },
  { id: 'cerrado', label: 'Cerrado' },
];

export function MasterTicketModal({ open, ticket, onClose }) {
  const { updateTicket } = useMaster();
  const [form, setForm] = useState({ respuesta: '', estado: 'en_revision', prioridad: 'normal' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !ticket) return;
    setForm({
      respuesta: ticket.respuesta || '',
      estado: ticket.estado === 'abierto' ? 'en_revision' : ticket.estado,
      prioridad: ticket.prioridad || 'normal',
    });
    setError('');
  }, [open, ticket]);

  if (!ticket) return null;

  const submit = async (event) => {
    event?.preventDefault();
    setError('');
    if (!form.respuesta.trim() && form.estado !== 'cerrado') {
      return setError('Escribe una respuesta antes de marcar el ticket como resuelto.');
    }
    setSaving(true);
    try {
      await updateTicket(ticket.id, {
        respuesta: form.respuesta.trim() || null,
        estado: form.estado,
        prioridad: form.prioridad,
      });
      onClose?.();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={ticket.asunto}
      subtitle={`${ticket.razon_social} · ${dateLabel(ticket.creado_en, { withTime: true })}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
          <Button icon={Send} onClick={submit} disabled={saving}>
            {saving ? 'Enviando…' : 'Guardar y responder'}
          </Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit}>
        <div className="master-ticket-meta field-full">
          <div>
            <span>Solicitante</span>
            <strong>{ticket.usuario_nombre || 'Usuario de la empresa'}</strong>
            <small>{ticket.usuario_email || '—'}</small>
          </div>
          <div>
            <span>Categoría</span>
            <strong className="master-capitalize">{ticket.categoria}</strong>
          </div>
          <div>
            <span>Prioridad</span>
            <Badge tone={ticket.prioridad === 'urgente' ? 'danger' : ticket.prioridad === 'alta' ? 'warn' : 'neutral'}>
              {ticket.prioridad}
            </Badge>
          </div>
          <div>
            <span>Estado</span>
            <Badge tone={ticket.estado === 'resuelto' || ticket.estado === 'cerrado' ? 'ok' : 'warn'}>
              {ticket.estado.replace('_', ' ')}
            </Badge>
          </div>
          <div>
            <span>Recibido</span>
            <strong>{relativeTime(ticket.creado_en)}</strong>
          </div>
        </div>

        <div className="master-ticket-message field-full">
          <span>Mensaje del cliente</span>
          <p>{ticket.mensaje}</p>
        </div>

        {ticket.respuesta ? (
          <div className="master-ticket-reply field-full">
            <span>Respuesta anterior · {dateLabel(ticket.respondido_en, { withTime: true })}</span>
            <p>{ticket.respuesta}</p>
          </div>
        ) : null}

        <Field label="Respuesta del supervisor" className="field-full">
          <textarea
            className="input"
            rows={5}
            value={form.respuesta}
            onChange={(event) => setForm((previous) => ({ ...previous, respuesta: event.target.value }))}
            placeholder="Escribe la respuesta que verá la empresa en su bandeja de soporte."
          />
        </Field>

        <Field label="Prioridad">
          <select
            className="input"
            value={form.prioridad}
            onChange={(event) => setForm((previous) => ({ ...previous, prioridad: event.target.value }))}
          >
            {PRIORIDADES.map((prioridad) => (
              <option key={prioridad.id} value={prioridad.id}>{prioridad.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Estado del ticket">
          <select
            className="input"
            value={form.estado}
            onChange={(event) => setForm((previous) => ({ ...previous, estado: event.target.value }))}
          >
            {ESTADOS.map((estado) => (
              <option key={estado.id} value={estado.id}>{estado.label}</option>
            ))}
          </select>
        </Field>

        {error ? <div className="form-error field-full">{error}</div> : null}
      </form>
    </Modal>
  );
}
