import { useEffect, useState } from 'react';
import { Building2, KeyRound, ShieldCheck } from 'lucide-react';
import { SECTOR_META } from '@shared/legal.js';
import { useMaster } from '../store/MasterContext.jsx';
import { Button, Field, Modal } from './ui.jsx';

const SECTORES = Object.values(SECTOR_META);
const EMPTY = {
  razon_social: '',
  rut_empresa: '',
  sector: 'seguridad',
  plan_id: '',
  dia_cobro: 1,
  admin_nombre: '',
  admin_email: '',
  admin_password: '',
  confirm: '',
};

export function MasterCompanyModal({ open, onClose }) {
  const { planes, createEmpresa } = useMaster();
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

    if (!form.razon_social.trim()) return setError('Ingresa la razón social de la empresa.');
    if (!form.rut_empresa.trim()) return setError('Ingresa el RUT de la empresa.');
    if (!form.admin_nombre.trim()) return setError('Ingresa el nombre del administrador.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.admin_email.trim())) {
      return setError('Ingresa un correo válido para el administrador.');
    }
    if (form.admin_password.length < 8) {
      return setError('La clave debe tener al menos 8 caracteres.');
    }
    if (form.admin_password !== form.confirm) {
      return setError('Las claves no coinciden.');
    }

    setSaving(true);
    try {
      await createEmpresa({
        empresa: {
          razon_social: form.razon_social.trim(),
          rut_empresa: form.rut_empresa.trim(),
          sector: form.sector,
          plan_id: form.plan_id || null,
          dia_cobro: Number(form.dia_cobro) || 1,
        },
        admin: {
          nombre: form.admin_nombre.trim(),
          email: form.admin_email.trim(),
          password: form.admin_password,
        },
      });
      onClose?.();
    } catch (requestError) {
      setError(requestError.message || 'No se pudo crear la empresa.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Nueva empresa"
      subtitle="Crea la cuenta operadora, asígnale un plan y su primer administrador."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button icon={Building2} onClick={submit} disabled={saving}>
            {saving ? 'Creando empresa…' : 'Crear empresa'}
          </Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit}>
        <div className="client-form-note field-full">
          <ShieldCheck size={17} />
          <div>
            <strong>Aislamiento por empresa</strong>
            <span>La empresa verá solo sus clientes, guardias y horarios. El supervisor mantiene acceso global.</span>
          </div>
        </div>

        <Field label="Razón social" className="field-full">
          <input
            className="input"
            value={form.razon_social}
            onChange={(event) => set('razon_social', event.target.value)}
            placeholder="Vigilancia Andes SpA"
            autoFocus
          />
        </Field>

        <Field label="RUT empresa">
          <input
            className="input"
            value={form.rut_empresa}
            onChange={(event) => set('rut_empresa', event.target.value)}
            placeholder="76.543.210-8"
            maxLength={12}
          />
        </Field>

        <Field label="Sector principal">
          <select
            className="input"
            value={form.sector}
            onChange={(event) => set('sector', event.target.value)}
          >
            {SECTORES.map((sector) => (
              <option key={sector.id} value={sector.id}>{sector.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Plan" hint="Puedes asignarlo ahora o dejarlo sin plan.">
          <select
            className="input"
            value={form.plan_id}
            onChange={(event) => set('plan_id', event.target.value)}
          >
            <option value="">Sin plan asignado</option>
            {planes
              .filter((plan) => plan.activo)
              .map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.nombre} · ${Number(plan.precio_mensual).toLocaleString('es-CL')}
                </option>
              ))}
          </select>
        </Field>

        <Field label="Día de cobro" hint="Entre el 1 y el 28 de cada mes.">
          <input
            className="input"
            type="number"
            min={1}
            max={28}
            value={form.dia_cobro}
            onChange={(event) => set('dia_cobro', event.target.value)}
          />
        </Field>

        <div className="master-form-divider field-full">
          <KeyRound size={16} />
          <div>
            <strong>Primer administrador</strong>
            <span>Con esta cuenta la empresa entra a TURNSOFT y crea a sus clientes.</span>
          </div>
        </div>

        <Field label="Nombre completo">
          <input
            className="input"
            value={form.admin_nombre}
            onChange={(event) => set('admin_nombre', event.target.value)}
            placeholder="Nombre y apellido"
            autoComplete="off"
          />
        </Field>

        <Field label="Correo">
          <input
            className="input"
            type="email"
            value={form.admin_email}
            onChange={(event) => set('admin_email', event.target.value)}
            placeholder="admin@empresa.cl"
            autoComplete="off"
          />
        </Field>

        <Field label="Clave">
          <input
            className="input"
            type="password"
            value={form.admin_password}
            onChange={(event) => set('admin_password', event.target.value)}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
          />
        </Field>

        <Field label="Repite la clave">
          <input
            className="input"
            type="password"
            value={form.confirm}
            onChange={(event) => set('confirm', event.target.value)}
            placeholder="Repite la clave"
            autoComplete="new-password"
          />
        </Field>

        {error ? <div className="form-error field-full">{error}</div> : null}
      </form>
    </Modal>
  );
}
