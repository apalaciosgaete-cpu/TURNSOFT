import { useEffect, useState } from 'react';
import { Save, ShieldCheck } from 'lucide-react';
import { useMaster } from '../store/MasterContext.jsx';
import { Button, Field, Modal, Toggle } from './ui.jsx';

const EMPTY = {
  nombre: '',
  descripcion: '',
  precio_mensual: '',
  max_clientes: '',
  max_usuarios: '',
  max_guardias: '',
  activo: true,
};

export function MasterPlanModal({ open, plan, onClose }) {
  const { createPlan, updatePlan } = useMaster();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const editing = Boolean(plan);

  useEffect(() => {
    if (!open) return;
    if (plan) {
      setForm({
        nombre: plan.nombre || '',
        descripcion: plan.descripcion || '',
        precio_mensual: String(plan.precio_mensual ?? ''),
        max_clientes: plan.max_clientes ?? '',
        max_usuarios: plan.max_usuarios ?? '',
        max_guardias: plan.max_guardias ?? '',
        activo: plan.activo !== false,
      });
    } else {
      setForm(EMPTY);
    }
    setError('');
  }, [open, plan]);

  const set = (key, value) => {
    setError('');
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const submit = async (event) => {
    event?.preventDefault();
    setError('');
    if (!form.nombre.trim()) return setError('Ingresa el nombre del plan.');
    const precio = Number(form.precio_mensual || 0);
    if (!Number.isInteger(precio) || precio < 0) {
      return setError('El precio debe ser un entero mayor o igual a 0.');
    }

    const payload = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      precio_mensual: precio,
      max_clientes: form.max_clientes === '' ? null : Number(form.max_clientes),
      max_usuarios: form.max_usuarios === '' ? null : Number(form.max_usuarios),
      max_guardias: form.max_guardias === '' ? null : Number(form.max_guardias),
      activo: form.activo,
    };

    if ([payload.max_clientes, payload.max_usuarios, payload.max_guardias].some((value) => value !== null && (!Number.isInteger(value) || value < 0))) {
      return setError('Los límites deben ser enteros mayores o iguales a 0, o quedar vacíos para ilimitado.');
    }

    setSaving(true);
    try {
      if (editing) await updatePlan(plan.id, payload);
      else await createPlan(payload);
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
      title={editing ? 'Editar plan' : 'Nuevo plan'}
      subtitle="Define el precio mensual y los límites que se validan en el backend."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button icon={Save} onClick={submit} disabled={saving}>
            {saving ? 'Guardando…' : editing ? 'Guardar plan' : 'Crear plan'}
          </Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit}>
        <div className="client-form-note field-full">
          <ShieldCheck size={17} />
          <div>
            <strong>Límites aplicados por el servidor</strong>
            <span>Los cupos de clientes y guardias se validan al crear registros. Deja un campo vacío para ilimitado.</span>
          </div>
        </div>

        <Field label="Nombre del plan" className="field-full">
          <input
            className="input"
            value={form.nombre}
            onChange={(event) => set('nombre', event.target.value)}
            placeholder="Operación Profesional"
            autoFocus
          />
        </Field>

        <Field label="Descripción" className="field-full">
          <textarea
            className="input"
            rows={2}
            value={form.descripcion}
            onChange={(event) => set('descripcion', event.target.value)}
            placeholder="Ideal para empresas con múltiples clientes y turnos 24/7."
          />
        </Field>

        <Field label="Precio mensual (CLP)">
          <input
            className="input"
            type="number"
            min={0}
            step={1000}
            value={form.precio_mensual}
            onChange={(event) => set('precio_mensual', event.target.value)}
            placeholder="99000"
          />
        </Field>

        <Field label="Máx. clientes" hint="Vacío = ilimitado">
          <input
            className="input"
            type="number"
            min={0}
            value={form.max_clientes}
            onChange={(event) => set('max_clientes', event.target.value)}
            placeholder="10"
          />
        </Field>

        <Field label="Máx. usuarios operadores" hint="Vacío = ilimitado">
          <input
            className="input"
            type="number"
            min={0}
            value={form.max_usuarios}
            onChange={(event) => set('max_usuarios', event.target.value)}
            placeholder="5"
          />
        </Field>

        <Field label="Máx. guardias" hint="Vacío = ilimitado">
          <input
            className="input"
            type="number"
            min={0}
            value={form.max_guardias}
            onChange={(event) => set('max_guardias', event.target.value)}
            placeholder="80"
          />
        </Field>

        <div className="field-full">
          <Toggle
            checked={form.activo}
            onChange={(checked) => set('activo', checked)}
            label="Plan disponible para nuevas empresas"
            description="Los planes inactivos no se ofrecen al dar de alta una empresa."
          />
        </div>

        {error ? <div className="form-error field-full">{error}</div> : null}
      </form>
    </Modal>
  );
}
