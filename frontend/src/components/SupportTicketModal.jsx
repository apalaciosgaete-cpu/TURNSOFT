import { useEffect, useState } from 'react';
import { Headphones, Send } from 'lucide-react';
import { Button, Field, Modal } from './ui.jsx';

const CATEGORIAS = [
  { id: 'consulta', label: 'Consulta general' },
  { id: 'pago', label: 'Pagos y planes' },
  { id: 'tecnico', label: 'Problema técnico' },
  { id: 'otro', label: 'Otro' },
];

const PRIORIDADES = [
  { id: 'baja', label: 'Baja' },
  { id: 'normal', label: 'Normal' },
  { id: 'alta', label: 'Alta' },
  { id: 'urgente', label: 'Urgente' },
];

const EMPTY = {
  asunto: '',
  categoria: 'consulta',
  prioridad: 'normal',
  mensaje: '',
};

export function SupportTicketModal({ open, onClose, onCreate }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY);
    setError('');
  }, [open]);

  const set = (key, value) => {
    setError('');
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const submit = async (event) => {
    event?.preventDefault();
    setError('');
    if (!form.asunto.trim()) return setError('Ingresa un asunto para el ticket.');
    if (!form.mensaje.trim()) return setError('Describe tu consulta o problema.');

    setSaving(true);
    try {
      await onCreate({
        asunto: form.asunto.trim(),
        mensaje: form.mensaje.trim(),
        categoria: form.categoria,
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
      title="Nuevo ticket de soporte"
      subtitle="El supervisor maestro recibirá tu solicitud y responderá por este mismo canal."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button icon={Send} onClick={submit} disabled={saving}>
            {saving ? 'Enviando…' : 'Enviar ticket'}
          </Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit}>
        <div className="client-form-note field-full">
          <Headphones size={17} />
          <div>
            <strong>Soporte directo con TURNSOFT</strong>
            <span>Tu empresa verá la respuesta en esta misma página. No se comparte con otras empresas.</span>
          </div>
        </div>

        <Field label="Asunto" className="field-full">
          <input
            className="input"
            value={form.asunto}
            onChange={(event) => set('asunto', event.target.value)}
            placeholder="Ej.: necesito ampliar mi plan de guardias"
            autoFocus
          />
        </Field>

        <Field label="Categoría">
          <select
            className="input"
            value={form.categoria}
            onChange={(event) => set('categoria', event.target.value)}
          >
            {CATEGORIAS.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>{categoria.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Prioridad">
          <select
            className="input"
            value={form.prioridad}
            onChange={(event) => set('prioridad', event.target.value)}
          >
            {PRIORIDADES.map((prioridad) => (
              <option key={prioridad.id} value={prioridad.id}>{prioridad.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Mensaje" className="field-full">
          <textarea
            className="input"
            rows={6}
            value={form.mensaje}
            onChange={(event) => set('mensaje', event.target.value)}
            placeholder="Cuéntanos qué necesitas, con el detalle que ayude a resolverlo."
          />
        </Field>

        {error ? <div className="form-error field-full">{error}</div> : null}
      </form>
    </Modal>
  );
}
