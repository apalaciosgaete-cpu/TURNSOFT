import { useState } from 'react';
import { Clock3, Moon, Pencil, Plus, Trash2 } from 'lucide-react';
import { SECTOR_META } from '@shared/legal.js';
import {
  formatHours,
  isOvernight,
  shiftLegalHours,
  shiftSpanHours,
  WEEKDAYS_SHORT,
} from '@shared/dates.js';
import { getAllowedDailyHours } from '@shared/model.js';
import { useTurnsoft } from '../store/TurnsoftContext.jsx';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  Stat,
} from '../components/ui.jsx';

const COLORS = ['#0f766e', '#0284c7', '#7c3aed', '#db2777', '#b45309', '#059669', '#dc2626', '#475569'];
const DEFAULT_COVERAGE = [1, 1, 1, 1, 1, 0, 0];

function emptyShift() {
  return {
    name: '',
    code: '',
    start: '09:00',
    end: '18:00',
    breakMinutes: 60,
    night: false,
    color: COLORS[0],
    coverage: [...DEFAULT_COVERAGE],
    requiredCertifications: '',
  };
}

export default function Shifts() {
  const { activeScenario: scenario, addShift, updateShift, removeShift } = useTurnsoft();
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(emptyShift);
  const [error, setError] = useState('');

  if (!scenario) return null;
  const meta = SECTOR_META[scenario.sector] || SECTOR_META.seguridad;
  const allowedDaily = getAllowedDailyHours(scenario.rules);
  const totalWeeklySlots = scenario.shifts.reduce(
    (total, shift) => total + shift.coverage.reduce((sum, value) => sum + Number(value || 0), 0),
    0
  );

  const openNew = () => {
    setForm(emptyShift());
    setEditor('new');
    setError('');
  };

  const openEdit = (shift) => {
    setForm({
      name: shift.name,
      code: shift.code,
      start: shift.start,
      end: shift.end,
      breakMinutes: shift.breakMinutes,
      night: Boolean(shift.night),
      color: shift.color,
      coverage: [...shift.coverage],
      requiredCertifications: (shift.requiredCertifications || []).join(', '),
    });
    setEditor(shift);
    setError('');
  };

  const set = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  const setCoverage = (index, value) => {
    const safe = Math.max(0, Math.min(20, Number(value) || 0));
    setForm((previous) => ({
      ...previous,
      coverage: previous.coverage.map((item, itemIndex) => (itemIndex === index ? safe : item)),
    }));
  };

  const save = (event) => {
    event.preventDefault();
    if (!form.name.trim()) return setError('El nombre del turno es obligatorio.');
    if (!form.code.trim()) return setError('El código es obligatorio.');
    if (!form.start || !form.end) return setError('Define hora de inicio y término.');
    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase().slice(0, 6),
      start: form.start,
      end: form.end,
      breakMinutes: Math.max(0, Number(form.breakMinutes) || 0),
      night: Boolean(form.night),
      color: form.color,
      coverage: form.coverage.map((value) => Number(value) || 0),
      requiredCertifications: form.requiredCertifications
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    };
    if (editor === 'new') addShift(scenario.id, payload);
    else updateShift(scenario.id, editor.id, payload);
    setEditor(null);
  };

  return (
    <div className="page shifts-page">
      <div className="stat-grid stat-grid-compact">
        <Stat label="Turnos configurados" value={scenario.shifts.length} hint={meta.label} icon={Clock3} />
        <Stat label="Cupos semanales" value={totalWeeklySlots} hint="Suma de cobertura Lun–Dom" icon={Clock3} />
        <Stat label="Tope diario aplicable" value={`${allowedDaily} h`} hint={scenario.rules.regime === 'excepcional' ? 'Régimen excepcional autorizado' : 'Jornada ordinaria'} icon={Clock3} />
        <Stat label="Colación por defecto" value={`${Math.round(scenario.shifts.reduce((sum, shift) => sum + Number(shift.breakMinutes || 0), 0) / Math.max(1, scenario.shifts.length))} min`} hint="Promedio de las plantillas" icon={Clock3} />
      </div>

      <Card
        title="Plantillas de turno"
        subtitle="La cobertura indica cuántas personas se necesitan cada día. Usa 0 para cerrar la operación ese día."
        actions={<Button size="sm" icon={Plus} onClick={openNew}>Nuevo turno</Button>}
      >
        {scenario.shifts.length === 0 ? (
          <EmptyState
            icon={Clock3}
            title="No hay turnos configurados"
            description="Crea al menos una plantilla para que el motor pueda asignar personas."
            action={<Button icon={Plus} onClick={openNew}>Crear turno</Button>}
          />
        ) : (
          <div className="shift-grid">
            {scenario.shifts.map((shift) => {
              const legal = shiftLegalHours(shift);
              const span = shiftSpanHours(shift);
              const overLimit = legal > allowedDaily + 0.001;
              const maxCoverage = Math.max(1, ...shift.coverage);
              return (
                <article className="shift-card" key={shift.id} style={{ '--shift-color': shift.color }}>
                  <div className="shift-card-bar" />
                  <header className="shift-card-head">
                    <div className="shift-code" style={{ background: `${shift.color}16`, color: shift.color }}>{shift.code}</div>
                    <div className="shift-title">
                      <h3>{shift.name}</h3>
                      <span>{shift.start}–{shift.end} {isOvernight(shift) ? '· cruza medianoche' : ''}</span>
                    </div>
                    <div className="shift-badges">
                      {shift.night ? <Badge tone="night"><Moon size={12} /> Nocturno</Badge> : null}
                      {overLimit ? <Badge tone="danger">Excede tope</Badge> : null}
                    </div>
                  </header>

                  <div className="shift-metrics">
                    <div>
                      <span>Presencia</span>
                      <strong>{formatHours(span)}</strong>
                    </div>
                    <div>
                      <span>Colación</span>
                      <strong>{shift.breakMinutes} min</strong>
                    </div>
                    <div>
                      <span>Computable</span>
                      <strong className={overLimit ? 'text-danger' : ''}>{formatHours(legal)}</strong>
                    </div>
                  </div>

                  <div className="coverage-week">
                    {shift.coverage.map((count, index) => (
                      <div className={`coverage-day ${Number(count) === 0 ? 'is-off' : ''}`} key={index}>
                        <span>{WEEKDAYS_SHORT[index]}</span>
                        <strong>{count}</strong>
                        <i style={{ height: `${Math.max(4, (Number(count) / maxCoverage) * 28)}px` }} />
                      </div>
                    ))}
                  </div>

                  <div className="shift-card-foot">
                    <div className="chip-row">
                      {(shift.requiredCertifications || []).length ? (
                        shift.requiredCertifications.map((name) => (
                          <span key={name} className="cert-chip"><Badge tone="neutral">{name}</Badge></span>
                        ))
                      ) : (
                        <span className="muted">Sin certificaciones exigidas</span>
                      )}
                    </div>
                    <div className="row-actions">
                      <button type="button" className="icon-btn" title="Editar turno" onClick={() => openEdit(shift)}>
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn danger"
                        title="Eliminar turno"
                        onClick={() => {
                          if (window.confirm(`¿Eliminar el turno "${shift.name}"? Los cupos asignados en la grilla quedarán libres.`)) {
                            removeShift(scenario.id, shift.id);
                          }
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}

            <button type="button" className="shift-add-card" onClick={openNew}>
              <span><Plus size={22} /></span>
              <strong>Agregar turno</strong>
              <small>Define horario, colación y cobertura</small>
            </button>
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(editor)}
        onClose={() => setEditor(null)}
        title={editor === 'new' ? 'Nuevo turno' : `Editar ${editor?.name || ''}`}
        subtitle="La jornada computable descuenta la colación. Los turnos sobre el tope aplicable se marcan como error."
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditor(null)}>Cancelar</Button>
            <Button onClick={save}>{editor === 'new' ? 'Crear turno' : 'Guardar cambios'}</Button>
          </>
        }
      >
        <form className="form-grid" onSubmit={save}>
          <Field label="Nombre del turno">
            <input className="input" value={form.name} onChange={(event) => set('name', event.target.value)} placeholder="Día 12 h" />
          </Field>
          <Field label="Código" hint="Se muestra en la grilla. Máximo 6 caracteres.">
            <input className="input" value={form.code} onChange={(event) => set('code', event.target.value)} placeholder="D12" maxLength={6} />
          </Field>
          <Field label="Hora de inicio">
            <input type="time" className="input" value={form.start} onChange={(event) => set('start', event.target.value)} />
          </Field>
          <Field label="Hora de término">
            <input type="time" className="input" value={form.end} onChange={(event) => set('end', event.target.value)} />
          </Field>
          <Field label="Colación (minutos)">
            <input type="number" min="0" max="180" className="input" value={form.breakMinutes} onChange={(event) => set('breakMinutes', event.target.value)} />
          </Field>
          <Field label="Color">
            <div className="color-row">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-dot ${form.color === color ? 'is-active' : ''}`}
                  style={{ background: color }}
                  onClick={() => set('color', color)}
                  aria-label={`Color ${color}`}
                />
              ))}
              <input type="color" className="color-input" value={form.color} onChange={(event) => set('color', event.target.value)} />
            </div>
          </Field>

          <div className="field field-full">
            <span className="field-label">Cobertura requerida por día</span>
            <div className="coverage-editor">
              {WEEKDAYS_SHORT.map((label, index) => (
                <label key={label} className="coverage-input">
                  <span>{label}</span>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={form.coverage[index]}
                    onChange={(event) => setCoverage(index, event.target.value)}
                  />
                </label>
              ))}
            </div>
            <span className="field-hint">El domingo y los festivos también se ajustan por las reglas de operación del escenario.</span>
          </div>

          <Field label="Certificaciones exigidas" hint="Sepáralas con coma. Ej: OS-10, Seguridad minera." className="field-full">
            <input className="input" value={form.requiredCertifications} onChange={(event) => set('requiredCertifications', event.target.value)} placeholder="OS-10" />
          </Field>

          <label className="toggle field-full">
            <span className="toggle-copy">
              <span className="toggle-label">Turno nocturno</span>
              <span className="toggle-description">Actívalo para aplicar los topes de noches consecutivas.</span>
            </span>
            <input type="checkbox" checked={form.night} onChange={(event) => set('night', event.target.checked)} />
            <span className="toggle-track" aria-hidden="true"><span className="toggle-thumb" /></span>
          </label>

          {error ? <div className="form-error field-full">{error}</div> : null}
        </form>
      </Modal>
    </div>
  );
}
