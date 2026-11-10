import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  CalendarClock,
  ClipboardList,
  Trash2,
  UserCheck,
  UserMinus,
} from 'lucide-react';
import { eachDate, formatDateShort } from '@shared/dates.js';
import { shiftCertificationsOk } from '@shared/model.js';
import {
  EXCEPTION_LABELS,
  PORTION_LABELS,
  getExceptions,
  sortExceptions,
} from '@shared/exceptions.js';
import { useTurnsoft } from '../store/TurnsoftContext.jsx';
import { Badge, Button, EmptyState, Field, Modal } from './ui.jsx';

const TABS = [
  { id: 'absence', label: 'Ausencia', icon: UserMinus },
  { id: 'swap', label: 'Cambio de día libre', icon: ArrowLeftRight },
  { id: 'coverage', label: 'Cobertura', icon: UserCheck },
];

const TONES = {
  absence: 'danger',
  swap: 'warn',
  coverage: 'info',
};

function emptyAbsence() {
  return { employeeId: '', date: '', portion: 'full', halfPeriod: 'first', reason: '' };
}

function emptySwap() {
  return { employeeId: '', offDate: '', workDate: '', reason: '' };
}

function emptyCoverage() {
  return { employeeId: '', date: '', replacementId: '', reason: '' };
}

export function ExceptionModal({
  open,
  onClose,
  initialEmployeeId = '',
  initialDate = '',
  initialTab = 'absence',
}) {
  const {
    activeScenario: scenario,
    registerAbsence,
    swapRestDay,
    coverAbsence,
    removeException,
  } = useTurnsoft();

  const [tab, setTab] = useState(initialTab);
  const [error, setError] = useState('');
  const [absenceForm, setAbsenceForm] = useState(emptyAbsence);
  const [swapForm, setSwapForm] = useState(emptySwap);
  const [coverageForm, setCoverageForm] = useState(emptyCoverage);

  const schedule = scenario?.schedule;
  const dates = useMemo(
    () => (schedule ? eachDate(schedule.startDate, schedule.days) : []),
    [schedule]
  );
  const employees = useMemo(
    () => (scenario?.employees || []).filter((employee) => employee.active !== false),
    [scenario]
  );
  const shiftMap = useMemo(
    () => new Map((scenario?.shifts || []).map((shift) => [shift.id, shift])),
    [scenario]
  );
  const employeeMap = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees]
  );
  const exceptions = useMemo(
    () => sortExceptions(getExceptions(scenario)),
    [scenario]
  );

  const cellFor = (employeeId, date) =>
    schedule?.cells?.[employeeId]?.[date] || { type: 'off' };

  const statusFor = (employeeId, date) => {
    const cell = cellFor(employeeId, date);
    if (cell.type === 'off') return { label: 'Libre', tone: 'neutral' };
    if (cell.type === 'absence') {
      return {
        label:
          cell.portion === 'half'
            ? 'Ausencia de medio turno'
            : 'Ausencia de día completo',
        tone: 'danger',
      };
    }
    const shift = shiftMap.get(cell.shiftId);
    return {
      label: shift ? `${shift.code} · ${shift.start}–${shift.end}` : 'Turno sin datos',
      tone: 'ok',
    };
  };

  const findSwapDefaults = (employeeId) => {
    if (!employeeId) return { offDate: '', workDate: '' };
    const initialCell = initialDate ? cellFor(employeeId, initialDate) : null;
    if (initialCell && initialDate) {
      if (initialCell.type === 'off') {
        const workDate = dates.find((date) => cellFor(employeeId, date).type === 'shift');
        if (workDate) return { offDate: initialDate, workDate };
      }
      if (initialCell.type === 'shift') {
        const offDate = dates.find((date) => cellFor(employeeId, date).type === 'off');
        if (offDate) return { offDate, workDate: initialDate };
      }
    }

    for (let index = 0; index < dates.length - 1; index += 1) {
      const current = cellFor(employeeId, dates[index]);
      const next = cellFor(employeeId, dates[index + 1]);
      if (current.type === 'off' && next.type === 'shift') {
        return { offDate: dates[index], workDate: dates[index + 1] };
      }
      if (current.type === 'shift' && next.type === 'off') {
        return { offDate: dates[index + 1], workDate: dates[index] };
      }
    }

    const anyOff = dates.find((date) => cellFor(employeeId, date).type === 'off');
    const anyShift = dates.find((date) => cellFor(employeeId, date).type === 'shift');
    return { offDate: anyOff || '', workDate: anyShift || '' };
  };

  const findWorkingEmployee = (date, preferredId) => {
    if (preferredId && cellFor(preferredId, date).type !== 'off') return preferredId;
    return employees.find((employee) => cellFor(employee.id, date).type !== 'off')?.id || '';
  };

  const findAbsentEmployee = (date, preferredId) => {
    if (preferredId && ['shift', 'absence'].includes(cellFor(preferredId, date).type)) {
      return preferredId;
    }
    return (
      employees.find((employee) => cellFor(employee.id, date).type === 'absence')?.id ||
      employees.find((employee) => cellFor(employee.id, date).type === 'shift')?.id ||
      preferredId ||
      ''
    );
  };

  const replacementOptions = (date, absentId) => {
    const absentCell = cellFor(absentId, date);
    const shift = shiftMap.get(absentCell.shiftId);
    return employees.filter((employee) => {
      if (employee.id === absentId) return false;
      if (cellFor(employee.id, date).type !== 'off') return false;
      if (!shift) return true;
      return shiftCertificationsOk(
        employee,
        shift,
        date,
        scenario?.rules?.requireCertifications
      );
    });
  };

  const findReplacement = (date, absentId) =>
    replacementOptions(date, absentId)[0]?.id || '';

  useEffect(() => {
    if (!open || !schedule) return;
    const date = initialDate || dates[0] || '';
    const preferredId = initialEmployeeId || '';
    const workingId = findWorkingEmployee(date, preferredId) || employees[0]?.id || '';
    const absentId = findAbsentEmployee(date, preferredId) || workingId;

    const swapEmployeeId =
      (preferredId && findSwapDefaults(preferredId).offDate && findSwapDefaults(preferredId).workDate
        ? preferredId
        : '') ||
      employees.find((employee) => {
        const pair = findSwapDefaults(employee.id);
        return pair.offDate && pair.workDate;
      })?.id ||
      workingId;

    setTab(initialTab);
    setError('');
    setAbsenceForm({
      ...emptyAbsence(),
      employeeId: workingId,
      date,
    });
    setSwapForm({
      ...emptySwap(),
      employeeId: swapEmployeeId,
      ...findSwapDefaults(swapEmployeeId),
    });
    setCoverageForm({
      ...emptyCoverage(),
      employeeId: absentId,
      date,
      replacementId: findReplacement(date, absentId),
    });
    // Solo se reinicia al abrir o cuando cambia el escenario activo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTab, initialEmployeeId, initialDate, scenario?.id, schedule?.startDate, schedule?.days]);

  const submitAbsence = (event) => {
    event.preventDefault();
    if (!absenceForm.employeeId || !absenceForm.date) {
      setError('Selecciona trabajador y fecha.');
      return;
    }
    const cell = cellFor(absenceForm.employeeId, absenceForm.date);
    if (cell.type === 'off') {
      setError('Ese día ya está libre; no hay turno que ausentar.');
      return;
    }
    if (cell.type === 'absence') {
      setError('Ya hay una ausencia registrada ese día. Anúlala primero en la lista.');
      return;
    }
    const result = registerAbsence(scenario.id, absenceForm);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose?.();
  };

  const submitSwap = (event) => {
    event.preventDefault();
    if (!swapForm.employeeId || !swapForm.offDate || !swapForm.workDate) {
      setError('Selecciona trabajador, día libre actual y nuevo día libre.');
      return;
    }
    if (swapForm.offDate === swapForm.workDate) {
      setError('El día libre actual y el nuevo deben ser distintos.');
      return;
    }
    if (cellFor(swapForm.employeeId, swapForm.offDate).type !== 'off') {
      setError('El día libre actual debe estar marcado como Libre en la grilla.');
      return;
    }
    if (cellFor(swapForm.employeeId, swapForm.workDate).type !== 'shift') {
      setError('El nuevo día libre debe tener un turno asignado en la grilla.');
      return;
    }
    const result = swapRestDay(scenario.id, swapForm);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose?.();
  };

  const changeCoverageEmployee = (employeeId) => {
    setCoverageForm((previous) => ({
      ...previous,
      employeeId,
      replacementId: findReplacement(previous.date, employeeId),
    }));
  };

  const changeCoverageDate = (date) => {
    setCoverageForm((previous) => ({
      ...previous,
      date,
      replacementId: findReplacement(date, previous.employeeId),
    }));
  };

  const submitCoverage = (event) => {
    event.preventDefault();
    if (!coverageForm.employeeId || !coverageForm.date || !coverageForm.replacementId) {
      setError('Selecciona la persona ausente, la fecha y quién cubrirá.');
      return;
    }
    const absentCell = cellFor(coverageForm.employeeId, coverageForm.date);
    if (absentCell.type === 'off') {
      setError('Ese día está libre; no hay inasistencia que cubrir.');
      return;
    }
    const result = coverAbsence(scenario.id, coverageForm);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose?.();
  };

  const handleRemove = (exception) => {
    if (!window.confirm('¿Anular esta novedad y restaurar la grilla?')) return;
    const result = removeException(scenario.id, exception.id);
    if (!result.ok) setError(result.error);
  };

  const absenceStatus = statusFor(absenceForm.employeeId, absenceForm.date);
  const swapOffStatus = statusFor(swapForm.employeeId, swapForm.offDate);
  const swapWorkStatus = statusFor(swapForm.employeeId, swapForm.workDate);
  const coverageStatus = statusFor(coverageForm.employeeId, coverageForm.date);
  const replacements = replacementOptions(coverageForm.date, coverageForm.employeeId);
  const coverageShift = shiftMap.get(
    cellFor(coverageForm.employeeId, coverageForm.date).shiftId
  );

  const exceptionDetail = (exception) => {
    const employee = employeeMap.get(exception.employeeId);
    if (exception.type === 'absence') {
      return `${employee?.name || 'Trabajador'} · ${formatDateShort(exception.date)} · ${
        PORTION_LABELS[exception.portion] || 'Ausencia'
      }`;
    }
    if (exception.type === 'swap') {
      return `${employee?.name || 'Trabajador'} · descanso ${formatDateShort(
        exception.offDate
      )} → ${formatDateShort(exception.workDate)}`;
    }
    const replacement = employeeMap.get(exception.replacementId);
    return `${replacement?.name || 'Reemplazo'} cubre a ${
      employee?.name || 'Trabajador'
    } · ${formatDateShort(exception.date)}`;
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novedades del horario"
      subtitle="Registra ausencias, cambia un día libre o asigna cobertura. La grilla y la validación se actualizan al instante."
      wide
      footer={<Button variant="ghost" onClick={onClose}>Cerrar</Button>}
    >
      {!schedule ? (
        <EmptyState
          icon={CalendarClock}
          title="Este escenario no tiene horario"
          description="Genera el horario antes de registrar novedades."
        />
      ) : (
        <div className="novedades">
          <div className="novedad-tabs" role="tablist" aria-label="Tipos de novedad">
            {TABS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  className={`novedad-tab ${tab === item.id ? 'is-active' : ''}`}
                  onClick={() => {
                    setTab(item.id);
                    setError('');
                  }}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {tab === 'absence' ? (
            <form className="form-grid novedad-form" onSubmit={submitAbsence}>
              <Field label="Trabajador">
                <select
                  className="input"
                  value={absenceForm.employeeId}
                  onChange={(event) =>
                    setAbsenceForm((previous) => ({ ...previous, employeeId: event.target.value }))
                  }
                >
                  <option value="">Selecciona</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Fecha del turno">
                <select
                  className="input"
                  value={absenceForm.date}
                  onChange={(event) =>
                    setAbsenceForm((previous) => ({ ...previous, date: event.target.value }))
                  }
                >
                  {dates.map((date) => (
                    <option key={date} value={date}>{formatDateShort(date)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Tipo de ausencia">
                <select
                  className="input"
                  value={absenceForm.portion}
                  onChange={(event) =>
                    setAbsenceForm((previous) => ({ ...previous, portion: event.target.value }))
                  }
                >
                  <option value="full">Día completo</option>
                  <option value="half">Medio turno</option>
                </select>
              </Field>
              {absenceForm.portion === 'half' ? (
                <Field label="Mitad ausente" hint="La otra mitad queda cubierta por la persona.">
                  <select
                    className="input"
                    value={absenceForm.halfPeriod}
                    onChange={(event) =>
                      setAbsenceForm((previous) => ({ ...previous, halfPeriod: event.target.value }))
                    }
                  >
                    <option value="first">Primer medio turno</option>
                    <option value="second">Segundo medio turno</option>
                  </select>
                </Field>
              ) : null}
              <div className="field field-full">
                <span className="field-label">Turno afectado</span>
                <div className="novedad-status">
                  <Badge tone={absenceStatus.tone}>{absenceStatus.label}</Badge>
                  <small>
                    {absenceStatus.tone === 'danger'
                      ? 'Ya existe una novedad en esta celda.'
                      : 'La ausencia descuenta las horas efectivas y deja el cupo sujeto a cobertura.'}
                  </small>
                </div>
              </div>
              <Field label="Motivo (opcional)" className="field-full">
                <textarea
                  className="input textarea"
                  rows="2"
                  value={absenceForm.reason}
                  onChange={(event) =>
                    setAbsenceForm((previous) => ({ ...previous, reason: event.target.value }))
                  }
                  placeholder="Licencia, trámite, salud, permiso..."
                />
              </Field>
              {error ? <div className="form-error field-full">{error}</div> : null}
              <div className="field-full novedad-actions">
                <Button type="submit" icon={UserMinus}>Registrar ausencia</Button>
              </div>
            </form>
          ) : null}

          {tab === 'swap' ? (
            <form className="form-grid novedad-form" onSubmit={submitSwap}>
              <Field label="Trabajador" className="field-full">
                <select
                  className="input"
                  value={swapForm.employeeId}
                  onChange={(event) => {
                    const employeeId = event.target.value;
                    setSwapForm((previous) => ({
                      ...previous,
                      employeeId,
                      ...findSwapDefaults(employeeId),
                    }));
                  }}
                >
                  <option value="">Selecciona</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Día libre actual" hint="Debe estar Libre en la grilla.">
                <select
                  className="input"
                  value={swapForm.offDate}
                  onChange={(event) =>
                    setSwapForm((previous) => ({ ...previous, offDate: event.target.value }))
                  }
                >
                  <option value="">Selecciona</option>
                  {dates.map((date) => (
                    <option key={date} value={date}>{formatDateShort(date)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Nuevo día libre" hint="Debe tener un turno asignado.">
                <select
                  className="input"
                  value={swapForm.workDate}
                  onChange={(event) =>
                    setSwapForm((previous) => ({ ...previous, workDate: event.target.value }))
                  }
                >
                  <option value="">Selecciona</option>
                  {dates.map((date) => (
                    <option key={date} value={date}>{formatDateShort(date)}</option>
                  ))}
                </select>
              </Field>
              <div className="field field-full">
                <span className="field-label">Resultado del cambio</span>
                <div className="novedad-status novedad-status-split">
                  <span>
                    <Badge tone={swapOffStatus.tone}>{swapOffStatus.label}</Badge>
                    <small>{swapForm.offDate ? formatDateShort(swapForm.offDate) : '—'} pasará a trabajarse</small>
                  </span>
                  <ArrowLeftRight size={16} />
                  <span>
                    <Badge tone={swapWorkStatus.tone}>{swapWorkStatus.label}</Badge>
                    <small>{swapForm.workDate ? formatDateShort(swapForm.workDate) : '—'} quedará libre</small>
                  </span>
                </div>
              </div>
              <Field label="Motivo (opcional)" className="field-full">
                <textarea
                  className="input textarea"
                  rows="2"
                  value={swapForm.reason}
                  onChange={(event) =>
                    setSwapForm((previous) => ({ ...previous, reason: event.target.value }))
                  }
                  placeholder="Cambio solicitado por la persona, cobertura de otro servicio..."
                />
              </Field>
              {error ? <div className="form-error field-full">{error}</div> : null}
              <div className="field-full novedad-actions">
                <Button type="submit" icon={ArrowLeftRight}>Permutar día libre</Button>
              </div>
            </form>
          ) : null}

          {tab === 'coverage' ? (
            <form className="form-grid novedad-form" onSubmit={submitCoverage}>
              <Field label="Persona ausente">
                <select
                  className="input"
                  value={coverageForm.employeeId}
                  onChange={(event) => changeCoverageEmployee(event.target.value)}
                >
                  <option value="">Selecciona</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Fecha de la inasistencia">
                <select
                  className="input"
                  value={coverageForm.date}
                  onChange={(event) => changeCoverageDate(event.target.value)}
                >
                  {dates.map((date) => (
                    <option key={date} value={date}>{formatDateShort(date)}</option>
                  ))}
                </select>
              </Field>
              <div className="field field-full">
                <span className="field-label">Turno que se cubre</span>
                <div className="novedad-status">
                  <Badge tone={coverageStatus.tone}>{coverageStatus.label}</Badge>
                  <small>
                    {coverageShift
                      ? `${coverageShift.name} · ${coverageShift.start}–${coverageShift.end}`
                      : 'Sin turno asociado a la celda.'}
                  </small>
                </div>
              </div>
              <Field
                label="Quién cubre"
                className="field-full"
                hint={
                  replacements.length
                    ? 'Solo se listan personas libres ese día y con las certificaciones vigentes.'
                    : 'No hay personas libres y certificadas para ese turno.'
                }
              >
                <select
                  className="input"
                  value={coverageForm.replacementId}
                  onChange={(event) =>
                    setCoverageForm((previous) => ({
                      ...previous,
                      replacementId: event.target.value,
                    }))
                  }
                  disabled={!replacements.length}
                >
                  <option value="">{replacements.length ? 'Selecciona' : 'Sin reemplazos disponibles'}</option>
                  {replacements.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} · {employee.role}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Motivo (opcional)" className="field-full">
                <textarea
                  className="input textarea"
                  rows="2"
                  value={coverageForm.reason}
                  onChange={(event) =>
                    setCoverageForm((previous) => ({ ...previous, reason: event.target.value }))
                  }
                  placeholder="Inasistencia imprevista, refuerzo de cobertura..."
                />
              </Field>
              {error ? <div className="form-error field-full">{error}</div> : null}
              <div className="field-full novedad-actions">
                <Button
                  type="submit"
                  icon={UserCheck}
                  disabled={!replacements.length || coverageStatus.tone === 'neutral'}
                >
                  Asignar cobertura
                </Button>
              </div>
            </form>
          ) : null}

          <section className="novedad-list">
            <header className="novedad-list-head">
              <div>
                <h3>Novedades registradas</h3>
                <p>Anular una novedad restaura las celdas originales del horario.</p>
              </div>
              <Badge tone="neutral">{exceptions.length}</Badge>
            </header>
            {exceptions.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="Sin novedades en este período"
                description="Las ausencias, cambios de descanso y coberturas que registres aparecerán aquí."
              />
            ) : (
              <div className="novedad-items">
                {exceptions.map((exception) => (
                  <div className="novedad-item" key={exception.id}>
                    <Badge tone={TONES[exception.type] || 'neutral'}>
                      {EXCEPTION_LABELS[exception.type] || 'Novedad'}
                    </Badge>
                    <div className="novedad-copy">
                      <strong>{exceptionDetail(exception)}</strong>
                      {exception.reason ? <span>{exception.reason}</span> : null}
                    </div>
                    <button
                      type="button"
                      className="icon-btn danger"
                      title="Anular novedad"
                      onClick={() => handleRemove(exception)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
