import { useMemo, useState } from 'react';
import { BadgeCheck, Pencil, Plus, Search, Trash2, UserCheck, UserX, Users } from 'lucide-react';
import { SECTOR_META } from '@shared/legal.js';
import { addDays, diffDays, formatDateShort } from '@shared/dates.js';
import { useTurnsoft } from '../store/TurnsoftContext.jsx';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  Stat,
} from '../components/ui.jsx';

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 7, label: 'Dom' },
];

function emptyEmployee(scenario) {
  return {
    name: '',
    role: '',
    weeklyContractHours: Number(scenario?.rules?.maxWeeklyHours) || 42,
    startDate: scenario?.startDate || '',
    phone: '',
    preferredShiftIds: [],
    unavailableWeekdays: [],
    certifications: [],
  };
}

export default function Staff() {
  const { activeScenario: scenario, addEmployee, updateEmployee, removeEmployee } = useTurnsoft();
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(() => emptyEmployee(scenario));
  const [error, setError] = useState('');

  const meta = SECTOR_META[scenario?.sector] || SECTOR_META.seguridad;
  const employees = scenario?.employees || [];
  const shifts = scenario?.shifts || [];
  const periodEnd = scenario ? addDays(scenario.startDate, scenario.days - 1) : '';

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter(
      (employee) =>
        employee.name.toLowerCase().includes(term) ||
        (employee.role || '').toLowerCase().includes(term)
    );
  }, [employees, query]);

  const certificationSummary = useMemo(() => {
    let expiring = 0;
    let expired = 0;
    for (const employee of employees) {
      for (const certification of employee.certifications || []) {
        if (!certification.expiresAt) continue;
        if (certification.expiresAt < scenario.startDate) expired += 1;
        else if (diffDays(periodEnd, certification.expiresAt) <= 45) expiring += 1;
      }
    }
    return { expiring, expired };
  }, [employees, scenario, periodEnd]);

  if (!scenario) return null;

  const openNew = () => {
    setForm(emptyEmployee(scenario));
    setEditor('new');
    setError('');
  };

  const openEdit = (employee) => {
    setForm({
      name: employee.name,
      role: employee.role || '',
      weeklyContractHours: employee.weeklyContractHours,
      startDate: employee.startDate || scenario.startDate,
      phone: employee.phone || '',
      preferredShiftIds: [...(employee.preferredShiftIds || [])],
      unavailableWeekdays: [...(employee.unavailableWeekdays || [])],
      certifications: (employee.certifications || []).map((certification) => ({ ...certification })),
    });
    setEditor(employee);
    setError('');
  };

  const set = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  const toggleInList = (key, value) => {
    setForm((previous) => {
      const list = previous[key];
      return {
        ...previous,
        [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value],
      };
    });
  };

  const save = (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    const hours = Number(form.weeklyContractHours);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 60) {
      setError('La jornada semanal debe estar entre 1 y 60 horas.');
      return;
    }
    const payload = {
      name: form.name.trim(),
      role: form.role.trim(),
      weeklyContractHours: hours,
      startDate: form.startDate,
      phone: form.phone,
      preferredShiftIds: form.preferredShiftIds,
      unavailableWeekdays: form.unavailableWeekdays.map(Number).sort(),
      certifications: form.certifications
        .filter((certification) => certification.name?.trim())
        .map((certification) => ({
          ...certification,
          name: certification.name.trim(),
          expiresAt: certification.expiresAt || '',
        })),
    };
    if (editor === 'new') addEmployee(scenario.id, payload);
    else updateEmployee(scenario.id, editor.id, payload);
    setEditor(null);
  };

  const addCertification = () => {
    setForm((previous) => ({
      ...previous,
      certifications: [
        ...previous.certifications,
        { id: `cert-${Date.now()}-${previous.certifications.length}`, name: '', expiresAt: '', issuer: '' },
      ],
    }));
  };

  const updateCertification = (index, patch) => {
    setForm((previous) => ({
      ...previous,
      certifications: previous.certifications.map((certification, certIndex) =>
        certIndex === index ? { ...certification, ...patch } : certification
      ),
    }));
  };

  const removeCertification = (index) => {
    setForm((previous) => ({
      ...previous,
      certifications: previous.certifications.filter((_, certIndex) => certIndex !== index),
    }));
  };

  const certificationBadges = (employee) => {
    const certifications = employee.certifications || [];
    if (!certifications.length) return <span className="muted">Sin certificaciones</span>;
    return (
      <div className="chip-row">
        {certifications.map((certification) => {
          const expired = certification.expiresAt && certification.expiresAt < scenario.startDate;
          const expiring =
            !expired &&
            certification.expiresAt &&
            diffDays(periodEnd, certification.expiresAt) <= 45;
          return (
            <span
              key={certification.id || certification.name}
              className={`cert-chip ${expired ? 'is-expired' : expiring ? 'is-expiring' : ''}`}
              title={certification.expiresAt ? `Vence el ${certification.expiresAt}` : 'Sin vencimiento'}
            >
              <BadgeCheck size={13} />
              {certification.name}
              {certification.expiresAt ? <em>{formatDateShort(certification.expiresAt)}</em> : null}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="page staff-page">
      <div className="stat-grid stat-grid-compact">
        <Stat label="Dotación total" value={employees.length} hint={`${employees.filter((employee) => employee.active !== false).length} activos`} icon={Users} />
        <Stat label="Certificaciones por vencer" value={certificationSummary.expiring} hint="Dentro de 45 días del término del período" icon={BadgeCheck} tone={certificationSummary.expiring ? 'warn' : 'ok'} />
        <Stat label="Certificaciones vencidas" value={certificationSummary.expired} hint="No habilitan turnos que las exijan" icon={BadgeCheck} tone={certificationSummary.expired ? 'danger' : 'ok'} />
        <Stat label="Turnos preferidos" value={employees.filter((employee) => (employee.preferredShiftIds || []).length).length} hint="Personas con preferencia declarada" icon={UserCheck} />
      </div>

      <Card
        title="Equipo del escenario"
        subtitle={`${meta.label} · ${scenario.company}`}
        actions={
          <div className="card-actions-row">
            <div className="search-box search-box-sm">
              <Search size={15} />
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar persona o rol…" />
            </div>
            <Button size="sm" icon={Plus} onClick={openNew}>Agregar persona</Button>
          </div>
        }
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={employees.length ? 'Sin resultados' : 'El equipo está vacío'}
            description={employees.length ? 'Prueba con otro nombre o rol.' : 'Agrega trabajadores para que el motor pueda cubrir los turnos.'}
            action={!employees.length ? <Button icon={Plus} onClick={openNew}>Agregar persona</Button> : null}
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table staff-table">
              <thead>
                <tr>
                  <th>Persona</th>
                  <th>Contrato</th>
                  <th>Preferencias</th>
                  <th>Disponibilidad</th>
                  <th>Certificaciones</th>
                  <th>Estado</th>
                  <th className="actions-col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((employee) => {
                  const preferred = (employee.preferredShiftIds || [])
                    .map((shiftId) => shifts.find((shift) => shift.id === shiftId))
                    .filter(Boolean);
                  const unavailable = employee.unavailableWeekdays || [];
                  return (
                    <tr key={employee.id} className={employee.active === false ? 'row-muted' : ''}>
                      <td>
                        <div className="person-cell">
                          <Avatar name={employee.name} color={employee.color} size={36} />
                          <div>
                            <strong>{employee.name}</strong>
                            <span>{employee.role || 'Sin rol definido'}</span>
                            {employee.phone ? <span className="cell-sub">{employee.phone}</span> : null}
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong>{employee.weeklyContractHours} h</strong>
                        <div className="cell-sub">Desde {employee.startDate ? formatDateShort(employee.startDate) : '—'}</div>
                      </td>
                      <td>
                        {preferred.length ? (
                          <div className="chip-row">
                            {preferred.map((shift) => (
                              <span key={shift.id} className="shift-chip" style={{ '--shift-color': shift.color }}>
                                <i />
                                {shift.code}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="muted">Sin preferencia</span>
                        )}
                      </td>
                      <td>
                        {unavailable.length ? (
                          <div className="chip-row">
                            {unavailable.map((day) => (
                              <span key={day} className="day-off-chip">{WEEKDAY_OPTIONS.find((option) => option.value === day)?.label || day}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="muted">Todos los días</span>
                        )}
                      </td>
                      <td>{certificationBadges(employee)}</td>
                      <td>
                        <Badge tone={employee.active === false ? 'neutral' : 'ok'} dot>
                          {employee.active === false ? 'Inactivo' : 'Activo'}
                        </Badge>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="icon-btn" title="Editar" onClick={() => openEdit(employee)}>
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            title={employee.active === false ? 'Activar' : 'Desactivar'}
                            onClick={() => updateEmployee(scenario.id, employee.id, { active: employee.active === false })}
                          >
                            {employee.active === false ? <UserCheck size={16} /> : <UserX size={16} />}
                          </button>
                          <button
                            type="button"
                            className="icon-btn danger"
                            title="Eliminar"
                            onClick={() => {
                              if (window.confirm(`¿Eliminar a ${employee.name} del escenario?`)) {
                                removeEmployee(scenario.id, employee.id);
                              }
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(editor)}
        onClose={() => setEditor(null)}
        title={editor === 'new' ? 'Agregar persona' : `Editar a ${editor?.name || ''}`}
        subtitle="Los cambios en dotación, certificaciones o disponibilidad hacen que el horario generado quede desactualizado."
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditor(null)}>Cancelar</Button>
            <Button onClick={save}>{editor === 'new' ? 'Agregar persona' : 'Guardar cambios'}</Button>
          </>
        }
      >
        <form className="form-grid" onSubmit={save}>
          <Field label="Nombre completo">
            <input className="input" value={form.name} onChange={(event) => set('name', event.target.value)} placeholder="Camila Rojas" />
          </Field>
          <Field label="Rol o cargo">
            <input className="input" value={form.role} onChange={(event) => set('role', event.target.value)} placeholder="Guardia de seguridad" />
          </Field>
          <Field label="Jornada semanal (h)" hint="Horas de contrato, no necesariamente las horas planificadas.">
            <input type="number" min="1" max="60" className="input" value={form.weeklyContractHours} onChange={(event) => set('weeklyContractHours', event.target.value)} />
          </Field>
          <Field label="Fecha de ingreso">
            <input type="date" className="input" value={form.startDate} onChange={(event) => set('startDate', event.target.value)} />
          </Field>
          <Field label="Teléfono de contacto">
            <input className="input" value={form.phone} onChange={(event) => set('phone', event.target.value)} placeholder="+56 9 ..." />
          </Field>

          <div className="field field-full">
            <span className="field-label">Turnos preferidos</span>
            <div className="check-grid">
              {shifts.map((shift) => (
                <label key={shift.id} className="check-pill">
                  <input
                    type="checkbox"
                    checked={form.preferredShiftIds.includes(shift.id)}
                    onChange={() => toggleInList('preferredShiftIds', shift.id)}
                  />
                  <i className="swatch" style={{ background: shift.color }} />
                  <span><strong>{shift.code}</strong> {shift.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="field field-full">
            <span className="field-label">Días no disponibles</span>
            <div className="day-toggle-row">
              {WEEKDAY_OPTIONS.map((option) => {
                const active = form.unavailableWeekdays.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`day-toggle ${active ? 'is-active' : ''}`}
                    onClick={() => toggleInList('unavailableWeekdays', option.value)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <span className="field-hint">Selecciona los días en que la persona no puede ser asignada.</span>
          </div>

          <div className="field field-full">
            <div className="field-label-row">
              <span className="field-label">Certificaciones</span>
              <Button type="button" variant="ghost" size="sm" icon={Plus} onClick={addCertification}>Agregar</Button>
            </div>
            {form.certifications.length === 0 ? (
              <p className="field-hint">Sin certificaciones. Los turnos que exijan credenciales no podrán asignarse a esta persona.</p>
            ) : (
              <div className="cert-editor">
                {form.certifications.map((certification, index) => (
                  <div className="cert-row" key={certification.id || index}>
                    <input
                      className="input"
                      value={certification.name}
                      onChange={(event) => updateCertification(index, { name: event.target.value })}
                      placeholder="Nombre, ej. OS-10"
                    />
                    <input
                      type="date"
                      className="input"
                      value={certification.expiresAt || ''}
                      onChange={(event) => updateCertification(index, { expiresAt: event.target.value })}
                      aria-label="Vencimiento"
                    />
                    <input
                      className="input"
                      value={certification.issuer || ''}
                      onChange={(event) => updateCertification(index, { issuer: event.target.value })}
                      placeholder="Emisor"
                    />
                    <button type="button" className="icon-btn danger" onClick={() => removeCertification(index)} aria-label="Quitar certificación">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error ? <div className="form-error field-full">{error}</div> : null}
        </form>
      </Modal>
    </div>
  );
}
