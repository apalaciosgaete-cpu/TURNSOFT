import { useEffect, useState } from 'react';
import { Building2, ShieldCheck } from 'lucide-react';
import { SECTOR_META } from '@shared/legal.js';
import { useAuth } from '../store/AuthContext.jsx';
import { Button, Field, Modal } from './ui.jsx';

const SECTORES = Object.values(SECTOR_META);
const EMPTY = {
  nombre: '',
  razon_social: '',
  rut: '',
  sector: 'seguridad',
  contacto: '',
  email: '',
  telefono: '',
  direccion: '',
  ciudad: '',
};

export function ClientModal({ open, onClose, onCreated }) {
  const { createClient } = useAuth();
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
    if (!form.nombre.trim()) {
      setError('Ingresa el nombre del cliente.');
      return;
    }
    setSaving(true);
    try {
      const created = await createClient({
        nombre: form.nombre.trim(),
        razon_social: form.razon_social.trim() || form.nombre.trim(),
        rut: form.rut.trim() || null,
        sector: form.sector,
        contacto: form.contacto.trim() || null,
        email: form.email.trim() || null,
        telefono: form.telefono.trim() || null,
        direccion: form.direccion.trim() || null,
        ciudad: form.ciudad.trim() || null,
        color: SECTOR_META[form.sector]?.accent || '#1d4ed8',
      });
      onCreated?.(created);
      onClose?.();
    } catch (err) {
      setError(err.message || 'No se pudo crear el cliente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo cliente"
      subtitle="El cliente tendrá su propia cuenta y solo verá su operación."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button icon={Building2} onClick={submit} disabled={saving}>
            {saving ? 'Creando cliente…' : 'Crear cliente'}
          </Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit}>
        <div className="client-form-note field-full">
          <ShieldCheck size={17} />
          <div>
            <strong>Aislamiento por cuenta</strong>
            <span>Los escenarios, la dotación y los horarios de este cliente no se compartirán con otros.</span>
          </div>
        </div>

        <Field label="Nombre del cliente" className="field-full" hint="Así aparecerá en el panel y en los reportes.">
          <input
            className="input"
            value={form.nombre}
            onChange={(event) => set('nombre', event.target.value)}
            placeholder="Condominio Parque Oriente"
            autoFocus
          />
        </Field>

        <Field label="Razón social">
          <input
            className="input"
            value={form.razon_social}
            onChange={(event) => set('razon_social', event.target.value)}
            placeholder="Comunidad Edificio Parque Oriente"
          />
        </Field>

        <Field label="RUT">
          <input
            className="input"
            value={form.rut}
            onChange={(event) => set('rut', event.target.value)}
            placeholder="76.543.210-8"
            maxLength={12}
          />
        </Field>

        <Field label="Sector">
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

        <Field label="Contacto">
          <input
            className="input"
            value={form.contacto}
            onChange={(event) => set('contacto', event.target.value)}
            placeholder="Nombre del contacto"
          />
        </Field>

        <Field label="Correo">
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(event) => set('email', event.target.value)}
            placeholder="contacto@cliente.cl"
          />
        </Field>

        <Field label="Teléfono">
          <input
            className="input"
            value={form.telefono}
            onChange={(event) => set('telefono', event.target.value)}
            placeholder="+56 9 1234 5678"
          />
        </Field>

        <Field label="Dirección" className="field-full">
          <input
            className="input"
            value={form.direccion}
            onChange={(event) => set('direccion', event.target.value)}
            placeholder="Av. Las Condes 11200"
          />
        </Field>

        <Field label="Ciudad">
          <input
            className="input"
            value={form.ciudad}
            onChange={(event) => set('ciudad', event.target.value)}
            placeholder="Santiago"
          />
        </Field>

        {error ? <div className="form-error field-full">{error}</div> : null}
      </form>
    </Modal>
  );
}
