import { useEffect, useState } from 'react';
import { BadgeCheck, RefreshCcw } from 'lucide-react';
import { useMaster } from '../store/MasterContext.jsx';
import { dateLabel, money, periodLabel } from '../lib/format.js';
import { Badge, Button, Field, Modal, Toggle } from './ui.jsx';

const METODOS = [
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'tarjeta', label: 'Tarjeta' },
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'otro', label: 'Otro' },
];

const ESTADOS = [
  { id: 'pendiente', label: 'Pendiente' },
  { id: 'pagado', label: 'Pagado' },
  { id: 'vencido', label: 'Vencido' },
  { id: 'anulado', label: 'Anulado' },
];

export function MasterPaymentVerify({ open, pago, onClose }) {
  const { empresas, updatePago } = useMaster();
  const [form, setForm] = useState({
    estado: 'pagado',
    metodo: 'transferencia',
    referencia: '',
    notas: '',
    reactivar: true,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const empresa = empresas.find((item) => item.id === pago?.empresa_id) || null;
  const suspendida = empresa?.estado === 'suspendida';

  useEffect(() => {
    if (!open || !pago) return;
    const nextState =
      pago.estado === 'pendiente' || pago.estado === 'vencido' ? 'pagado' : pago.estado;
    setForm({
      estado: nextState,
      metodo: pago.metodo || 'transferencia',
      referencia: pago.referencia || '',
      notas: pago.notas || '',
      reactivar: true,
    });
    setError('');
  }, [open, pago]);

  if (!pago) return null;

  const submit = async (event) => {
    event?.preventDefault();
    setError('');
    setSaving(true);
    try {
      await updatePago(pago.id, {
        estado: form.estado,
        metodo: form.metodo,
        referencia: form.referencia.trim() || null,
        notas: form.notas.trim() || null,
        reactivar: form.estado === 'pagado' && form.reactivar,
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
      title="Verificar pago"
      subtitle={`${pago.razon_social || empresa?.razon_social || 'Empresa'} · ${periodLabel(pago.periodo)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button icon={BadgeCheck} onClick={submit} disabled={saving}>
            {saving ? 'Guardando…' : form.estado === 'pagado' ? 'Verificar pago' : 'Guardar estado'}
          </Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit}>
        <div className="master-payment-summary field-full">
          <div>
            <span>Monto</span>
            <strong>{money(pago.monto)}</strong>
          </div>
          <div>
            <span>Período</span>
            <strong>{periodLabel(pago.periodo)}</strong>
          </div>
          <div>
            <span>Vencimiento</span>
            <strong>{dateLabel(pago.fecha_vencimiento)}</strong>
          </div>
          <div>
            <span>Estado actual</span>
            <Badge tone={pago.estado === 'pagado' ? 'ok' : pago.estado === 'vencido' ? 'danger' : 'warn'}>
              {pago.estado}
            </Badge>
          </div>
        </div>

        <Field label="Estado del pago">
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

        <Field label="Método">
          <select
            className="input"
            value={form.metodo}
            onChange={(event) => setForm((previous) => ({ ...previous, metodo: event.target.value }))}
          >
            {METODOS.map((metodo) => (
              <option key={metodo.id} value={metodo.id}>{metodo.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Referencia" className="field-full">
          <input
            className="input"
            value={form.referencia}
            onChange={(event) => setForm((previous) => ({ ...previous, referencia: event.target.value }))}
            placeholder="Número de transferencia o comprobante"
          />
        </Field>

        <Field label="Notas" className="field-full">
          <textarea
            className="input"
            rows={3}
            value={form.notas}
            onChange={(event) => setForm((previous) => ({ ...previous, notas: event.target.value }))}
            placeholder="Observaciones de la verificación."
          />
        </Field>

        {suspendida ? (
          <div className="field-full master-reactivate-box">
            <Toggle
              checked={form.reactivar}
              onChange={(checked) => setForm((previous) => ({ ...previous, reactivar: checked }))}
              label="Reactivar la empresa al verificar el pago"
              description={`${empresa.razon_social} está bloqueada por ${empresa.motivo_bloqueo || 'falta de pago'}.`}
              disabled={form.estado !== 'pagado'}
            />
            <span className="master-reactivate-hint">
              <RefreshCcw size={14} /> Al guardar, el acceso de todos sus usuarios se restaura de inmediato.
            </span>
          </div>
        ) : null}

        {error ? <div className="form-error field-full">{error}</div> : null}
      </form>
    </Modal>
  );
}
