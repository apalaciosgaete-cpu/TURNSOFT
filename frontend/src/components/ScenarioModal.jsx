import { useEffect, useMemo, useState } from 'react';
import { Building2, Contact, Clock3 } from 'lucide-react';
import { SECTOR_META } from '@shared/legal.js';
import { todayISO } from '@shared/dates.js';
import { apiRequest, useAuth } from '../store/AuthContext.jsx';
import { useTurnsoft } from '../store/TurnsoftContext.jsx';
import { activeGuardias, guardiaToEmployee, plantillaToShift } from '../lib/baseImport.js';
import { Button, Field, Modal, SectorIcon } from './ui.jsx';

const SECTORS = Object.values(SECTOR_META);

function clientLocation(client) {
  return [client?.address, client?.city].filter(Boolean).join(', ');
}

function defaultDays(sector) {
  return sector === 'seguridad' ? 32 : 28;
}

/** "2026-12-01" -> "Diciembre 2026" */
function periodName(startDate) {
  const date = new Date(`${startDate || todayISO()}T12:00:00`);
  if (Number.isNaN(date.getTime())) return 'Nueva planificación';
  const text = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' })
    .format(date)
    .replace(' de ', ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function emptyForm(client, fallbackSector, companyName) {
  const sector = client?.sector || fallbackSector || 'seguridad';
  return {
    clientId: client?.id || '',
    sector,
    name: '',
    company: client?.legalName || client?.name || companyName || '',
    location: clientLocation(client),
    startDate: todayISO(),
    days: defaultDays(sector),
    notes: '',
    useBase: true,
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
  const { token } = useAuth();
  const [form, setForm] = useState(() => emptyForm(null, null, ''));
  const [error, setError] = useState('');
  const [base, setBase] = useState({ guardias: [], plantillas: [] });

  const lockedClientId = isOperator ? null : session?.clientId || null;
  const canBringBase = isOperator && !scenario;

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
        useBase: false,
      });
    } else {
      const preferredId = initialClientId || lockedClientId || activeClientId;
      const client = clients.find((item) => item.id === preferredId) || null;
      setForm(emptyForm(client, session?.empresaSector, session?.empresa));
    }
    setError('');
  }, [open, scenario, initialClientId, lockedClientId, activeClientId, clients, session?.empresaSector, session?.empresa]);

  // Personal y horarios base de la empresa: se ofrecen al crear una planificación.
  useEffect(() => {
    if (!open || !canBringBase || !token) return undefined;
    let cancelled = false;
    Promise.all([
      apiRequest('/guardias', { token }),
      apiRequest('/turno-plantillas', { token }),
    ])
      .then(([guardias, plantillas]) => {
        if (cancelled) return;
        setBase({
          guardias: activeGuardias(guardias),
          plantillas: Array.isArray(plantillas) ? plantillas : [],
        });
      })
      .catch(() => {
        if (!cancelled) setBase({ guardias: [], plantillas: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [open, canBringBase, token]);

  const hasBase = base.guardias.length > 0 || base.plantillas.length > 0;
  const suggestedName = useMemo(() => periodName(form.startDate), [form.startDate]);

  const set = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  const changeClient = (clientId) => {
    const client = clients.find((item) => item.id === clientId);
    setForm((previous) => {
      const sector = client?.sector || previous.sector;
      return {
        ...previous,
        clientId,
        company: client?.legalName || client?.name || session?.empresa || previous.company,
        location: clientLocation(client) || previous.location,
        sector,
        days: defaultDays(sector),
      };
    });
  };

  const changeSector = (sector) => {
    setForm((previous) => ({ ...previous, sector, days: defaultDays(sector) }));
  };

  const submit = (event) => {
    event.preventDefault();
    if (!form.startDate) {
      setError('Selecciona una fecha de inicio.');
      return;
    }
    if (Number(form.days) < 7 || Number(form.days) > 92) {
      setError('El período debe estar entre 7 y 92 días.');
      return;
    }
    const name = form.name.trim() || suggestedName;
    if (scenario) {
      updateScenarioMeta(scenario.id, {
        name,
        company: form.company.trim(),
        location: form.location.trim(),
        startDate: form.startDate,
        days: Number(form.days),
        notes: form.notes,
      });
      notify('Datos de la planificación actualizados.');
    } else {
      const bringing = canBringBase && form.useBase && hasBase;
      const employees = bringing
        ? base.guardias.map((guardia) => guardiaToEmployee(guardia, { startDate: form.startDate }))
        : [];
      const shifts = bringing ? base.plantillas.map((plantilla) => plantillaToShift(plantilla)) : [];
      const notice = bringing
        ? `Planificación creada con ${employees.length} trabajador${employees.length === 1 ? '' : 'es'}${
            shifts.length ? ` y ${shifts.length} turno${shifts.length === 1 ? '' : 's'} de tu empresa` : ''
          }. Genera el horario cuando estés listo.`
        : undefined;
      const created = addScenario({
        ...form,
        clientId: isOperator ? form.clientId || null : undefined,
        name,
        company: form.company.trim(),
        days: Number(form.days),
        employees,
        shifts,
        notice,
      });
      if (!created) return;
    }
    onClose?.();
  };

  const showClientPicker = !scenario && isOperator && clients.length > 0;
  const clientName = clients.find((client) => client.id === form.clientId)?.name;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={scenario ? 'Editar planificación' : 'Nueva planificación'}
      subtitle={
        scenario
          ? 'Si cambias el período, el horario se reinicia.'
          : 'Es el período que quieres programar, por ejemplo un mes. Parte con tu personal y tus turnos.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit}>{scenario ? 'Guardar cambios' : 'Crear planificación'}</Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit}>
        {showClientPicker ? (
          <Field label="¿Para quién es?" className="field-full">
            <select
              className="input"
              value={form.clientId}
              onChange={(event) => changeClient(event.target.value)}
            >
              <option value="">{session?.empresa || 'Mi empresa'} · operación propia</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  Cliente: {client.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {(scenario && clientName) || (!isOperator && lockedClientId) ? (
          <div className="field field-full">
            <span className="field-label">Cliente</span>
            <div className="client-locked">
              <Building2 size={16} />
              <span>{clientName || session?.clientName || 'Cliente de la sesión'}</span>
              <small>Los datos no se comparten con otras cuentas.</small>
            </div>
          </div>
        ) : null}

        {!scenario ? (
          <div className="field field-full">
            <span className="field-label">Sector</span>
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

        <Field label="Nombre" className="field-full" hint="Si lo dejas vacío se llamará igual que el período.">
          <input
            className="input"
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
            placeholder={suggestedName}
          />
        </Field>

        <Field label="Fecha de inicio">
          <input type="date" className="input" value={form.startDate} onChange={(event) => set('startDate', event.target.value)} />
        </Field>

        <Field label="Días a planificar" hint="Entre 7 y 92 días. Los ciclos 4x4 y 7x7 se ven mejor con 28 días o más.">
          <input type="number" min="7" max="92" className="input" value={form.days} onChange={(event) => set('days', event.target.value)} />
        </Field>

        {canBringBase && hasBase ? (
          <label className="base-import field-full">
            <input
              type="checkbox"
              checked={form.useBase}
              onChange={(event) => set('useBase', event.target.checked)}
            />
            <span>
              <strong>Traer mis trabajadores y mis turnos</strong>
              <small>
                <Contact size={13} /> {base.guardias.length} trabajador{base.guardias.length === 1 ? '' : 'es'} activo{base.guardias.length === 1 ? '' : 's'}
                {' · '}
                <Clock3 size={13} /> {base.plantillas.length} horario{base.plantillas.length === 1 ? '' : 's'} base.
                {base.plantillas.length
                  ? ' Tus turnos reemplazan a los predefinidos del sector.'
                  : ' Se usarán los turnos predefinidos del sector.'}
              </small>
            </span>
          </label>
        ) : null}

        <details className="field-full form-more">
          <summary>Más datos (opcional)</summary>
          <div className="form-grid">
            <Field label="Empresa u organización">
              <input className="input" value={form.company} onChange={(event) => set('company', event.target.value)} placeholder="Mi Empresa SpA" />
            </Field>
            <Field label="Ubicación">
              <input className="input" value={form.location} onChange={(event) => set('location', event.target.value)} placeholder="Santiago, Región Metropolitana" />
            </Field>
            <Field label="Notas operativas" className="field-full">
              <textarea className="input textarea" rows="3" value={form.notes} onChange={(event) => set('notes', event.target.value)} placeholder="Contexto del servicio, régimen autorizado, particularidades del contrato..." />
            </Field>
          </div>
        </details>

        {error ? <div className="form-error field-full">{error}</div> : null}
      </form>
    </Modal>
  );
}
