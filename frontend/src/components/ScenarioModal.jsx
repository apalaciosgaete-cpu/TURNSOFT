import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { SECTOR_META } from '@shared/legal.js';
import { todayISO } from '@shared/dates.js';
import { useTurnsoft } from '../store/TurnsoftContext.jsx';
import { Button, Field, Modal, SectorIcon } from './ui.jsx';

const SECTORS = Object.values(SECTOR_META);

function clientLocation(client) {
  return [client?.address, client?.city].filter(Boolean).join(', ');
}

function emptyForm(client) {
  const sector = client?.sector || 'seguridad';
  return {
    clientId: client?.id || '',
    sector,
    name: '',
    company: client?.legalName || client?.name || '',
    location: clientLocation(client),
    startDate: todayISO(),
    days: sector === 'seguridad' ? 32 : 28,
    notes: '',
  };
}

export function ScenarioModal({ open, onClose, scenario = null, initialClientId = null }) {
  const {
    addScenario,
    updateScenarioMeta,
    notify,
    clients,
    activeClientId,
    isOperator,
    session,
  } = useTurnsoft();
  const [form, setForm] = useState(() => emptyForm(null));
  const [error, setError] = useState('');

  const lockedClientId = isOperator ? activeClientId : session?.clientId || null;

  useEffect(() => {
    if (!open) return;
    if (scenario) {
      setForm({
        clientId: scenario.clientId || '',
        sector: scenario.sector,
        name: scenario.name,
        company: scenario.company,
        location: scenario.location,
        startDate: scenario.startDate,
        days: scenario.days,
        notes: scenario.notes || '',
      });
    } else {
      const preferredId = initialClientId || lockedClientId;
      const client =
        clients.find((item) => item.id === preferredId) ||
        (clients.length === 1 ? clients[0] : null);
      setForm(emptyForm(client));
    }
    setError('');
  }, [open, scenario, initialClientId, lockedClientId, clients]);

  const set = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  const changeClient = (clientId) => {
    const client = clients.find((item) => item.id === clientId);
    setForm((previous) => ({
      ...previous,
      clientId,
      company: client?.legalName || client?.name || previous.company,
      location: clientLocation(client) || previous.location,
      sector: client?.sector || previous.sector,
      days: client?.sector === 'seguridad' ? 32 : 28,
    }));
  };

  const changeSector = (sector) => {
    setForm((previous) => ({
      ...previous,
      sector,
      days: sector === 'seguridad' ? 32 : 28,
    }));
  };

  const submit = (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('Ponle un nombre al escenario.');
      return;
    }
    if (!form.startDate) {
      setError('Selecciona una fecha de inicio.');
      return;
    }
    if (Number(form.days) < 7 || Number(form.days) > 92) {
      setError('El período debe estar entre 7 y 92 días.');
      return;
    }
    if (isOperator && !form.clientId) {
      setError('Selecciona el cliente al que pertenece el escenario.');
      return;
    }
    if (scenario) {
      updateScenarioMeta(scenario.id, {
        name: form.name.trim(),
        company: form.company.trim(),
        location: form.location.trim(),
        startDate: form.startDate,
        days: Number(form.days),
        notes: form.notes,
      });
      notify('Datos del escenario actualizados.');
    } else {
      const created = addScenario({
        ...form,
        name: form.name.trim(),
        company: form.company.trim(),
        days: Number(form.days),
      });
      if (!created) return;
    }
    onClose?.();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={scenario ? 'Editar escenario' : 'Nuevo escenario'}
      subtitle={
        scenario
          ? 'Si cambias el período, el horario se reinicia.'
          : 'El escenario queda asociado a un cliente y parte con la dotación que definas.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit}>{scenario ? 'Guardar cambios' : 'Crear escenario'}</Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit}>
        <div className="field field-full">
          <span className="field-label">Cliente</span>
          {scenario || lockedClientId || !isOperator ? (
            <div className="client-locked">
              <Building2 size={16} />
              <span>
                {clients.find((client) => client.id === form.clientId)?.name ||
                  'Cliente de la sesión'}
              </span>
              <small>Los datos no se comparten con otras cuentas.</small>
            </div>
          ) : (
            <select
              className="input"
              value={form.clientId}
              onChange={(event) => changeClient(event.target.value)}
            >
              <option value="">Selecciona un cliente</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} · {SECTOR_META[client.sector]?.short || client.sector}
                </option>
              ))}
            </select>
          )}
        </div>

        {!scenario ? (
          <div className="field field-full">
            <span className="field-label">Sector del servicio</span>
            <div className="sector-picker">
              {SECTORS.map((sector) => (
                <button
                  key={sector.id}
                  type="button"
                  className={`sector-option ${form.sector === sector.id ? 'is-active' : ''}`}
                  onClick={() => changeSector(sector.id)}
                  style={{ '--sector-color': sector.accent, '--sector-tint': sector.tint }}
                >
                  <SectorIcon sector={sector.id} meta={sector} size={18} />
                  <span>{sector.short}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <Field label="Nombre del escenario" className="field-full">
          <input className="input" value={form.name} onChange={(event) => set('name', event.target.value)} placeholder="Condominio Parque · Santiago" />
        </Field>

        <Field label="Empresa u organización">
          <input className="input" value={form.company} onChange={(event) => set('company', event.target.value)} placeholder="Mi Empresa SpA" />
        </Field>

        <Field label="Ubicación">
          <input className="input" value={form.location} onChange={(event) => set('location', event.target.value)} placeholder="Santiago, Región Metropolitana" />
        </Field>

        <Field label="Fecha de inicio">
          <input type="date" className="input" value={form.startDate} onChange={(event) => set('startDate', event.target.value)} />
        </Field>

        <Field label="Días a planificar" hint="Entre 7 y 92 días. Los ciclos 4x4 y 7x7 se ven mejor con 28 días o más.">
          <input type="number" min="7" max="92" className="input" value={form.days} onChange={(event) => set('days', event.target.value)} />
        </Field>

        <Field label="Notas operativas" className="field-full">
          <textarea className="input textarea" rows="3" value={form.notes} onChange={(event) => set('notes', event.target.value)} placeholder="Contexto del servicio, régimen autorizado, particularidades del contrato..." />
        </Field>

        {error ? <div className="form-error field-full">{error}</div> : null}
      </form>
    </Modal>
  );
}
