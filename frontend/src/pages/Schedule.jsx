import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  Download,
  FileJson,
  Printer,
  RefreshCw,
  Search,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { SECTOR_META } from '@shared/legal.js';
import { getHolidayMap } from '@shared/holidays.js';
import {
  eachDate,
  formatDateLong,
  formatRange,
  formatDateShort,
  shiftLegalHours,
  startOfWeek,
  weekdayISO,
  WEEKDAYS_SHORT,
} from '@shared/dates.js';
import { formatSlotValue, getExceptions } from '@shared/exceptions.js';
import { useTurnsoft } from '../store/TurnsoftContext.jsx';
import { downloadFile, csvLines } from '../lib/download.js';
import { Avatar, Badge, Button, Card, EmptyState, Progress } from '../components/ui.jsx';
import { ExceptionModal } from '../components/ExceptionModal.jsx';

export default function Schedule() {
  const {
    activeScenario: scenario,
    activeValidation: validation,
    generate,
    busyScenarioId,
    setCell,
    removeException,
    notify,
    isStale,
  } = useTurnsoft();
  const [query, setQuery] = useState('');
  const [novedad, setNovedad] = useState({
    open: false,
    employeeId: '',
    date: '',
    tab: 'absence',
  });

  const schedule = scenario?.schedule;
  const meta = SECTOR_META[scenario?.sector] || SECTOR_META.seguridad;
  const busy = busyScenarioId === scenario?.id;

  const dates = useMemo(
    () => (schedule ? eachDate(schedule.startDate, schedule.days) : []),
    [schedule]
  );

  const holidayMap = useMemo(
    () =>
      scenario
        ? getHolidayMap(scenario.startDate, scenario.days, {
            custom: scenario.holidays || [],
            regions: scenario.regions || [],
          })
        : {},
    [scenario]
  );

  const shiftMap = useMemo(
    () => new Map((scenario?.shifts || []).map((shift) => [shift.id, shift])),
    [scenario]
  );

  const coverageMap = useMemo(
    () => new Map((validation?.coverage || []).map((item) => [item.date, item])),
    [validation]
  );

  const employees = useMemo(
    () => (scenario?.employees || []).filter((employee) => employee.active !== false),
    [scenario]
  );

  const employeeMap = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees]
  );

  const exceptionList = useMemo(() => getExceptions(scenario), [scenario]);
  const exceptionCount = exceptionList.length;

  const coverageByReplacement = useMemo(() => {
    const map = new Map();
    for (const exception of exceptionList) {
      if (exception.type === 'coverage') {
        map.set(`${exception.replacementId}|${exception.date}`, exception.employeeId);
      }
    }
    return map;
  }, [exceptionList]);

  const filteredEmployees = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter(
      (employee) =>
        employee.name.toLowerCase().includes(term) ||
        (employee.role || '').toLowerCase().includes(term)
    );
  }, [employees, query]);

  const weekGroups = useMemo(() => {
    const groups = [];
    for (const date of dates) {
      const key = startOfWeek(date);
      let group = groups.find((item) => item.key === key);
      if (!group) {
        group = { key, dates: [] };
        groups.push(group);
      }
      group.dates.push(date);
    }
    return groups;
  }, [dates]);

  const metricsByEmployee = useMemo(
    () => new Map((validation?.employeeMetrics || []).map((item) => [item.employeeId, item])),
    [validation]
  );

  const stale = scenario ? isStale(scenario) : false;

  if (!scenario) return null;

  const exportJson = () => {
    downloadFile(
      `turnsoft-${scenario.sector}-${scenario.startDate}.json`,
      JSON.stringify(
        {
          app: 'TURNSOFT',
          exportedAt: new Date().toISOString(),
          scenario,
          validationSummary: validation?.metrics || null,
        },
        null,
        2
      ),
      'application/json;charset=utf-8'
    );
  };

  const exportCsv = () => {
    const rows = [
      ['Fecha', 'Día', 'Trabajador', 'Rol', 'Turno', 'Código', 'Inicio', 'Fin', 'Horas computables', 'Noche', 'Domingo', 'Feriado'],
    ];
    for (const date of dates) {
      for (const employee of employees) {
        const cell = schedule.cells?.[employee.id]?.[date];
        if (cell?.type !== 'shift') continue;
        const shift = shiftMap.get(cell.shiftId);
        if (!shift) continue;
        rows.push([
          date,
          WEEKDAYS_SHORT[weekdayISO(date) - 1],
          employee.name,
          employee.role,
          shift.name,
          shift.code,
          shift.start,
          shift.end,
          shiftLegalHours(shift).toFixed(1).replace('.', ','),
          shift.night ? 'Sí' : 'No',
          weekdayISO(date) === 7 ? 'Sí' : 'No',
          holidayMap[date]?.name || '',
        ]);
      }
    }
    downloadFile(
      `turnsoft-horario-${scenario.sector}-${scenario.startDate}.csv`,
      `\uFEFF${csvLines(rows)}`,
      'text/csv;charset=utf-8'
    );
  };

  return (
    <div className="page schedule-page">
      <div className="page-toolbar">
        <div className="toolbar-info">
          <Badge tone="sector">{meta.label}</Badge>
          <span><CalendarDays size={15} /> {formatRange(scenario.startDate, scenario.days)}</span>
          <span><Users size={15} /> {employees.length} personas</span>
          {schedule?.meta?.strategy ? (
            <span className="mono-chip">motor: {schedule.meta.strategy}</span>
          ) : null}
          {schedule?.meta?.manualEdits ? (
            <Badge tone="warn">{schedule.meta.manualEdits} ajuste(s) manual(es)</Badge>
          ) : null}
          {exceptionCount ? (
            <Badge tone="info">{exceptionCount} novedad(es)</Badge>
          ) : null}
        </div>
        <div className="toolbar-actions">
          <Button
            variant="ghost"
            size="sm"
            icon={CalendarClock}
            onClick={() =>
              setNovedad({ open: true, employeeId: '', date: '', tab: 'absence' })
            }
          >
            Novedades{exceptionCount ? ` · ${exceptionCount}` : ''}
          </Button>
          <Button variant="ghost" size="sm" icon={Download} onClick={exportCsv} disabled={!schedule}>CSV</Button>
          <Button variant="ghost" size="sm" icon={FileJson} onClick={exportJson} disabled={!schedule}>JSON</Button>
          <Button variant="ghost" size="sm" icon={Printer} onClick={() => window.print()} disabled={!schedule}>Imprimir</Button>
          <Button size="sm" icon={busy ? RefreshCw : Sparkles} onClick={() => generate(scenario.id)} disabled={busy} className={busy ? 'is-busy' : ''}>
            {busy ? 'Generando…' : schedule ? 'Regenerar' : 'Generar horario'}
          </Button>
        </div>
      </div>

      {!schedule ? (
        <Card>
          <EmptyState
            icon={Sparkles}
            title="Este escenario todavía no tiene horario"
            description="El motor distribuirá la dotación según el patrón del sector, las reglas de jornada, los descansos y las certificaciones vigentes."
            action={<Button icon={Sparkles} onClick={() => generate(scenario.id)} disabled={busy}>{busy ? 'Generando…' : 'Generar horario'}</Button>}
          />
        </Card>
      ) : (
        <>
          {stale ? (
            <div className="notice notice-warn">
              <AlertTriangle size={18} />
              <div>
                <strong>La configuración cambió después de generar este horario.</strong>
                <p>Regenera para aplicar los nuevos turnos, reglas o dotación. La validación actual ya usa la configuración vigente.</p>
              </div>
              <Button size="sm" variant="soft" icon={RefreshCw} onClick={() => generate(scenario.id)}>Regenerar</Button>
            </div>
          ) : null}

          {validation?.metrics?.errors > 0 ? (
            <div className="notice notice-danger">
              <AlertTriangle size={18} />
              <div>
                <strong>{validation.metrics.errors} error(es) de cumplimiento.</strong>
                <p>Revisa los reportes antes de publicar el horario. Los ajustes manuales pueden romper descansos o topes.</p>
              </div>
              <Link to="/reportes" className="btn btn-soft btn-sm">Ver reportes</Link>
            </div>
          ) : null}

          <div className="toolbar-row">
            <div className="search-box">
              <Search size={16} />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre o rol…"
              />
            </div>
            <div className="legend">
              {scenario.shifts.map((shift) => (
                <span className="legend-item" key={shift.id}>
                  <i className="swatch" style={{ background: shift.color }} />
                  <strong>{shift.code}</strong>
                  <span>{shift.name} · {shift.start}–{shift.end}</span>
                </span>
              ))}
              <span className="legend-item">
                <i className="swatch swatch-off" />
                <strong>Libre</strong>
                <span>descanso</span>
              </span>
            </div>
          </div>

          <div className="schedule-scroll">
            <table className="schedule-table">
              <thead>
                <tr className="week-band">
                  <th className="corner-cell" rowSpan="2">
                    <span>Trabajador</span>
                    <span className="corner-sub">{filteredEmployees.length} visibles</span>
                  </th>
                  {weekGroups.map((week) => (
                    <th key={week.key} colSpan={week.dates.length} className="week-cell">
                      {formatRange(week.dates[0], week.dates.length)}
                    </th>
                  ))}
                  <th className="summary-cell" rowSpan="2">Resumen</th>
                </tr>
                <tr className="day-band">
                  {dates.map((date) => {
                    const weekday = weekdayISO(date);
                    const holiday = holidayMap[date];
                    const coverage = coverageMap.get(date);
                    const missing = coverage ? coverage.missing > 0 : false;
                    return (
                      <th
                        key={date}
                        className={`day-cell ${weekday === 7 ? 'is-sunday' : ''} ${holiday ? 'is-holiday' : ''}`}
                        title={holiday ? `${holiday.name} · ${formatDateLong(date)}` : formatDateLong(date)}
                      >
                        <span className="day-weekday">{WEEKDAYS_SHORT[weekday - 1]}</span>
                        <strong>{Number(date.slice(8, 10))}</strong>
                        <span className={`day-coverage ${missing ? 'is-missing' : ''}`}>
                          {coverage
                            ? `${formatSlotValue(coverage.assigned)}/${coverage.required}`
                            : '—'}
                        </span>
                        {holiday ? <i className="holiday-mark" title={holiday.name} /> : null}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((employee) => {
                  const summary = metricsByEmployee.get(employee.id);
                  return (
                    <tr key={employee.id}>
                      <th className="employee-cell">
                        <Avatar name={employee.name} color={employee.color} size={32} />
                        <span className="employee-copy">
                          <strong>{employee.name}</strong>
                          <span>{employee.role} · {employee.weeklyContractHours} h</span>
                        </span>
                      </th>
                      {dates.map((date) => {
                        const cell = schedule.cells?.[employee.id]?.[date];
                        const isAbsence = cell?.type === 'absence';
                        const shift =
                          cell?.type === 'shift' || isAbsence
                            ? shiftMap.get(cell.shiftId)
                            : null;
                        const holiday = holidayMap[date];
                        const coveredEmployeeId = coverageByReplacement.get(
                          `${employee.id}|${date}`
                        );
                        const coveredEmployee = coveredEmployeeId
                          ? employeeMap.get(coveredEmployeeId)
                          : null;
                        return (
                          <td
                            key={date}
                            className={`shift-cell ${weekdayISO(date) === 7 ? 'is-sunday' : ''} ${holiday ? 'is-holiday' : ''} ${isAbsence ? 'has-absence' : ''}`}
                          >
                            {isAbsence ? (
                              <div
                                className={`cell-absence ${cell.portion === 'half' ? 'is-half' : ''}`}
                                title={`${employee.name} · ${formatDateLong(date)} · ${
                                  cell.portion === 'half' ? 'ausencia de medio turno' : 'ausencia de día completo'
                                }${cell.reason ? ` · ${cell.reason}` : ''}`}
                              >
                                <strong>{cell.portion === 'half' ? '½ turno' : 'Ausencia'}</strong>
                                <span>{shift?.code || '—'}</span>
                                {cell.exceptionId ? (
                                  <button
                                    type="button"
                                    className="cell-clear"
                                    title="Quitar ausencia y restaurar turno"
                                    onClick={() => {
                                      const result = removeException(
                                        scenario.id,
                                        cell.exceptionId
                                      );
                                      if (!result.ok) notify(result.error, 'error');
                                    }}
                                  >
                                    <X size={10} />
                                  </button>
                                ) : null}
                              </div>
                            ) : (
                              <>
                                <select
                                  className={`cell-select ${shift ? 'has-shift' : 'is-off'}`}
                                  value={shift?.id || ''}
                                  onChange={(event) => setCell(scenario.id, employee.id, date, event.target.value || null)}
                                  title={`${employee.name} · ${formatDateLong(date)}`}
                                  style={
                                    shift
                                      ? {
                                          color: shift.color,
                                          backgroundColor: `${shift.color}16`,
                                          borderColor: `${shift.color}52`,
                                        }
                                      : undefined
                                  }
                                >
                                  <option value="">Libre</option>
                                  {scenario.shifts.map((option) => (
                                    <option key={option.id} value={option.id}>
                                      {option.code}
                                    </option>
                                  ))}
                                </select>
                                {shift ? <span className="cell-time">{shift.start}–{shift.end}</span> : null}
                                <button
                                  type="button"
                                  className="cell-novedad"
                                  title="Registrar ausencia, cambio de día libre o cobertura"
                                  onClick={() =>
                                    setNovedad({
                                      open: true,
                                      employeeId: employee.id,
                                      date,
                                      tab: 'absence',
                                    })
                                  }
                                >
                                  <CalendarClock size={10} />
                                </button>
                                {coveredEmployee ? (
                                  <span
                                    className="cell-cover-mark"
                                    title={`Cubre a ${coveredEmployee.name}`}
                                  >
                                    C
                                  </span>
                                ) : null}
                              </>
                            )}
                          </td>
                        );
                      })}
                      <td className="summary-cell">
                        {summary ? (
                          <div className="row-summary">
                            <span>{summary.hours.toFixed(0)} h</span>
                            <span>{summary.daysWorked} d</span>
                            {summary.nights > 0 ? <span>{summary.nights} N</span> : null}
                          </div>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                <tr className="coverage-row">
                  <th className="employee-cell">
                    <span className="coverage-row-label">Cobertura del día</span>
                  </th>
                  {dates.map((date) => {
                    const coverage = coverageMap.get(date);
                    if (!coverage || coverage.required === 0) {
                      return <td key={date} className="coverage-cell is-closed">—</td>;
                    }
                    const pct = coverage.required ? (coverage.assigned / coverage.required) * 100 : 100;
                    return (
                      <td key={date} className={`coverage-cell ${coverage.missing > 0 ? 'is-missing' : 'is-complete'}`}>
                        <Progress value={pct} tone={coverage.missing > 0 ? 'danger' : 'ok'} />
                        <span>{formatSlotValue(coverage.assigned)}/{coverage.required}</span>
                      </td>
                    );
                  })}
                  <td className="summary-cell coverage-total">
                    <strong>{Math.round(validation.metrics.coveragePct)}%</strong>
                    <span>{formatSlotValue(validation.metrics.filledSlots)}/{validation.metrics.requiredSlots}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <Card title="Resumen por persona" subtitle="Horas computables, descansos y exposición a domingos y noches.">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Trabajador</th>
                    <th className="num">Horas</th>
                    <th className="num">Días</th>
                    <th className="num">Ausencias</th>
                    <th className="num">Coberturas</th>
                    <th className="num">Prom. semanal</th>
                    <th className="num">Domingos trabajados</th>
                    <th className="num">Domingos libres</th>
                    <th className="num">Noches</th>
                    <th className="num">Máx. consecutivos</th>
                    <th className="num">Descanso mínimo</th>
                  </tr>
                </thead>
                <tbody>
                  {validation?.employeeMetrics?.map((item) => (
                    <tr key={item.employeeId}>
                      <td>
                        <strong>{item.name}</strong>
                        <div className="cell-sub">{item.role}</div>
                      </td>
                      <td className="num">{item.hours.toFixed(1)}</td>
                      <td className="num">{formatSlotValue(item.daysWorked)}</td>
                      <td className="num">
                        {item.absences || 0}
                        {item.halfDays ? <span className="muted"> + {item.halfDays}½</span> : null}
                      </td>
                      <td className="num">{item.coverages || 0}</td>
                      <td className="num">
                        {item.weeklyAverage.toFixed(1)} h
                        {item.weeklyAverage > (scenario.rules.maxWeeklyHours || 42) ? <Badge tone="danger">sobre tope</Badge> : null}
                      </td>
                      <td className="num">{item.sundaysWorked}</td>
                      <td className="num">{item.sundaysOff}</td>
                      <td className="num">{item.nights}</td>
                      <td className="num">{item.maxConsecutive}</td>
                      <td className="num">{item.minRest === null ? '—' : `${item.minRest.toFixed(1)} h`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <p className="page-hint">
            Cambia un turno desde la celda o usa el botón de calendario para registrar una ausencia, permutar un día libre o asignar cobertura. Las novedades se guardan en este navegador y se validan automáticamente.
          </p>
        </>
      )}

      <ExceptionModal
        open={novedad.open}
        onClose={() => setNovedad((previous) => ({ ...previous, open: false }))}
        initialEmployeeId={novedad.employeeId}
        initialDate={novedad.date}
        initialTab={novedad.tab}
      />
    </div>
  );
}
