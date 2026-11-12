import { useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { useMaster } from '../store/MasterContext.jsx';
import { currentPeriod, money } from '../lib/format.js';
import { Button, Field, Modal } from './ui.jsx';

const METODOS = [
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'tarjeta', label: 'Tarjeta' },
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'otro', label: 'Otro' },
];

export function MasterPaymentModal({ open, onClose, empresaId = '' }) {
  const { empresas, planes, createPago } = useMaster();
  const [form, setForm] = useState({
    empresa_id: '',
    periodo: currentPeriod(),
    monto: '',
    metodo: 'transferencia',
    referencia: '',
    fecha_vencimiento: '',
    notas: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const empresa = empresas.find((item) => item.id === empresaId) || null;
    const plan = planes.find((item) => item.id === empresa?.plan_id) || null;
    const dueDay = String(empresa?.dia_cobro || 1).padStart(2, '0');
    setForm({
      empresa_id: empresaId || '',
      periodo: currentPeriod(),
      monto: plan ? String(plan.precio_mensual) : '',
      metodo: 'transferencia',
      referencia: '',
      fecha_vencimiento: `${currentPeriod()}-${dueDay}`,
      notas: '',
    });
    setError('');
  }, [open, empresaId, empresas, planes]);

  const set = (key, value) => {
    setError('');
    setForm((previous) => {
      const next = { ...previous, [key]: value };
      if (key === 'empresa_id') {
        const empresa = empresas.find((item) => item.id === value);
        const plan = planes.find((item) => item.id === empresa?.plan_id);
        if (plan) next.monto = String(plan.precio_mensual);
        if (empresa) {
          next.fecha_vencimiento = `${next.periodo}-${String(empresa.dia_cobro || 1).padStart(2, '0')}`;
        }
      }
      if (key === 'periodo' && next.empresa_id) {
        const empresa = empresas.find((item) => item.id === next.empresa_id);
        if (empresa) {
          next.fecha_vencimiento = `${value}-${String(empresa.dia_cobro || 1).padStart(2, '0')}`;
        }
      }
      return next;
    });
  };

  const submit = async (event) => {
    event?.preventDefault();
    setError('');
    if (!form.empresa_id) return setError('Selecciona la empresa que paga.');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(form.periodo)) {
      return setError('Selecciona el período de cobro.');
    }
    const monto = Number(form.monto);
    if (!Number.isInteger(monto) || monto < 0) {
      return setError('El monto debe ser un número entero mayor o igual a 0.');
    }

    setSaving(true);
    try {
      await createPago({
        empresa_id: form.empresa_id,
        periodo: form.periodo,
        monto,
        metodo: form.metodo,
        referencia: form.referencia.trim() || null,
        fecha_vencimiento: form.fecha_vencimiento || null,
        notas: form.notas.trim() || null,
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
      title="Registrar pago"
      subtitle="Queda como pendiente hasta que el supervisor lo verifique."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button icon={CreditCard} onClick={submit} disabled={saving}>
            {saving ? 'Registrando…' : 'Registrar pago'}
          </Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit}>
        <Field label="Empresa" className="field-full">
          <select
            className="input"
            value={form.empresa_id}
            onChange={(event) => set('empresa_id', event.target.value)}
          >
            <option value="">Selecciona una empresa</option>
            {empresas.map((empresa) => (
              <option key={empresa.id} value={empresa.id}>
                {empresa.razon_social} · {empresa.plan_nombre || 'Sin plan'}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Período">
          <input
            className="input"
            type="month"
            value={form.periodo}
            onChange={(event) => set('periodo', event.target.value)}
          />
        </Field>

        <Field label="Monto (CLP)">
          <input
            className="input"
            type="number"
            min={0}
            step={1}
            value={form.monto}
            onChange={(event) => set('monto', event.target.value)}
          />
        </Field>

        <Field label="Método">
          <select
            className="input"
            value={form.metodo}
            onChange={(event) => set('metodo', event.target.value)}
          >
            {METODOS.map((metodo) => (
              <option key={metodo.id} value={metodo.id}>{metodo.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Vencimiento">
          <input
            className="input"
            type="date"
            value={form.fecha_vencimiento}
            onChange={(event) => set('fecha_vencimiento', event.target.value)}
          />
        </Field>

        <Field label="Referencia" className="field-full" hint="Número de transferencia, folio o comprobante.">
          <input
            className="input"
            value={form.referencia}
            onChange={(event) => set('referencia', event.target.value)}
            placeholder="TRF-000123"
          />
        </Field>

        <Field label="Notas" className="field-full">
          <textarea
            className="input"
            rows={3}
            value={form.notas}
            onChange={(event) => set('notas', event.target.value)}
            placeholder="Acuerdo de pago, observaciones, etc."
          />
        </Field>

        {form.monto ? (
          <div className="master-form-hint field-full">
            Se registrará un pago por <strong>{money(form.monto)}</strong> correspondiente a {form.periodo}.
          </div>
        ) : null}

        {error ? <div className="form-error field-full">{error}</div> : null}
      </form>
    </Modal>
  );
}
