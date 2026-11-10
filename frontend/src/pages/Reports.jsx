import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileJson,
  Filter,
  Printer,
  Sparkles,
  Users,
} from 'lucide-react';
import { DISCLAIMER, SECTOR_META } from '@shared/legal.js';
import {
  formatDateShort,
  formatRange,
  weekdayISO,
} from '@shared/dates.js';
import { useTurnsoft } from '../store/TurnsoftContext.jsx';
import { csvLines, downloadFile } from '../lib/download.js';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FindingItem,
  Progress,
  Ring,
  Stat,
} from '../components/ui.jsx';

const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'error', label: 'Errores' },
  { id: 'warning', label: 'Advertencias' },
  { id: 'info', label: 'Información' },
];

export default function Reports() {
  const {
    activeScenario: scenario,
    activeValidation: validation,
    generate,
    busyScenarioId,
  } = useTurnsoft();
  const [severity, setSeverity] = useState('all');

  const metrics = validation?.metrics;
  const busy = busyScenarioId === scenario?.id;

  const findings = useMemo(
    () =>
      (validation?.findings || []).filter((finding) =>
        severity === 'all' ? true : finding.severity === severity
      ),
    [validation, severity]
  );

  const employeeErrors = useMemo(() => {
    const map = new Map();
    for (const finding of validation?.findings || []) {
      if (finding.severity !== 'error' || !finding.employeeId) continue;
      map.set(finding.employeeId, (map.get(finding.employeeId) || 0) + 1);
    }
    return map;
  }, [validation]);

  const gapDays = useMemo(
    () => (validation?.coverage || []).filter((day) => day.missing > 0),
    [validation]
  );

  if (!scenario) return null;

  const meta = SECTOR_META[scenario.sector] || SECTOR_META.seguridad;
  const hasSchedule = Boolean(scenario.schedule);

  const exportJson = () => {
    downloadFile(
      `turnsoft-reporte-${scenario.sector}-${scenario.startDate}.json`,
      JSON.stringify(
        {
          app: 'TURNSOFT',
          exportedAt: new Date().toISOString(),
          scenario: {
            id: scenario.id,
            name: scenario.name,
            company: scenario.company,
            sector: scenario.sector,
            startDate: scenario.startDate,
            days: scenario.days,
            rules: scenario.rules,
            shifts: scenario.shifts,
            employees: scenario.employees,
          },
          report: validation,
        },
        null,
        2
      ),
      'application/json;charset=utf-8'
    );
  };

  const exportCsv = () => {
    const rows = [
      ['TURNSOFT - Reporte de cumplimiento'],
      ['Escenario', scenario.name],
      ['Empresa', scenario.company],
      ['Sector', meta.label],
      ['Período', formatRange(scenario.startDate, scenario.days)],
      ['Generado', new Date().toISOString()],
      ['Índice de cumplimiento', metrics.score],
      ['Cobertura %', metrics.coveragePct.toFixed(1)],
      ['Errores', metrics.errors],
      ['Advertencias', metrics.warnings],
      [],
      ['Semana', 'Desde', 'Hasta', 'Cupos requeridos', 'Cupos cubiertos', 'Cobertura %'],
      ...(validation.weeks || []).map((week) => [
        week.weekKey,
        week.startDate,
        week.endDate,
        week.required,
        week.filled,
        week.required ? ((week.filled / week.required) * 100).toFixed(1) : '100',
      ]),
      [],
      ['Trabajador', 'Rol', 'Contrato h', 'Horas', 'Promedio semanal', 'Días', 'Domingos trabajados', 'Domingos libres', 'Festivos trabajados', 'Noches', 'Máx. consecutivos', 'Máx. noches', 'Descanso mínimo h', 'Errores'],
      ...(validation.employeeMetrics || []).map((employee) => [
        employee.name,
        employee.role,
        employee.contractHours,
        employee.hours.toFixed(1),
        employee.weeklyAverage.toFixed(1),
        employee.daysWorked,
        employee.sundaysWorked,
        employee.sundaysOff,
        employee.holidaysWorked,
        employee.nights,
        employee.maxConsecutive,
        employee.maxNightStreak,
        employee.minRest === null ? '' : employee.minRest.toFixed(1),
        employeeErrors.get(employee.employeeId) || 0,
      ]),
      [],
      ['Severidad', 'Código', 'Título', 'Detalle', 'Fecha'],
      ...(validation.findings || []).map((finding) => [
        finding.severity,
        finding.code,
        finding.title,
        finding.detail,
        finding.date || '',
      ]),
    ];
    downloadFile(
      `turnsoft-reporte-${scenario.sector}-${scenario.startDate}.csv`,
      `\uFEFF${csvLines(rows)}`,
      'text/csv;charset=utf-8'
    );
  };

  return (
    <div className="page reports-page">
      <div className="page-toolbar">
        <div className="toolbar-info">
          <Badge tone="sector">{meta.label}</Badge>
          <span><CalendarDays size={15} /> {formatRange(scenario.startDate, scenario.days)}</span>
          <span><Users size={15} /> {metrics.activeEmployees} personas</span>
          {hasSchedule ? (
            <Badge tone={metrics.errors > 0 ? 'danger' : metrics.warnings > 0 ? 'warn' : 'ok'} dot>
              {metrics.errors > 0 ? `${metrics.errors} error(es)` : metrics.warnings > 0 ? `${metrics.warnings} advertencia(s)` : 'Sin hallazgos'}
            </Badge>
          ) : null}
        </div>
        <div className="toolbar-actions">
          <Button variant="ghost" size="sm" icon={Download} onClick={exportCsv} disabled={!hasSchedule}>CSV</Button>
          <Button variant="ghost" size="sm" icon={FileJson} onClick={exportJson} disabled={!hasSchedule}>JSON</Button>
          <Button variant="ghost" size="sm" icon={Printer} onClick={() => window.print()} disabled={!hasSchedule}>Imprimir</Button>
          <Button size="sm" icon={busy ? Clock3 : Sparkles} onClick={() => generate(scenario.id)} disabled={busy}>
            {busy ? 'Generando…' : 'Regenerar'}
          </Button>
        </div>
      </div>

      {!hasSchedule ? (
        <Card>
          <EmptyState
            icon={BarChart3}
            title="No hay datos para reportar"
            description="Genera un horario para obtener métricas de cobertura, jornada, descansos y cumplimiento legal."
            action={<Button icon={Sparkles} onClick={() => generate(scenario.id)}>Generar horario</Button>}
          />
        </Card>
      ) : (
        <>
          <section className="report-hero">
            <Ring value={metrics.score} label="de 100" tone={metrics.score >= 90 ? '#0f766e' : metrics.score >= 70 ? '#b45309' : '#b91c1c'} size={142} />
            <div className="report-hero-copy">
              <Badge tone="sector">{meta.label}</Badge>
              <h2>{scenario.name}</h2>
              <p>{scenario.company} · {formatRange(scenario.startDate, scenario.days)}</p>
              <div className="report-hero-flags">
                <span className={metrics.errors ? 'is-danger' : 'is-ok'}>
                  {metrics.errors ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                  {metrics.errors} error(es)
                </span>
                <span className={metrics.warnings ? 'is-warn' : 'is-ok'}>
                  <AlertTriangle size={15} />
                  {metrics.warnings} advertencia(s)
                </span>
                <span><Clock3 size={15} /> {metrics.totalHours.toFixed(0)} h planificadas</span>
                <span><CalendarDays size={15} /> {metrics.sundayShifts} turnos en domingo</span>
              </div>
            </div>
            <div className="report-hero-side">
              <div>
                <span>Cobertura</span>
                <strong>{Math.round(metrics.coveragePct)}%</strong>
                <small>{metrics.filledSlots}/{metrics.requiredSlots} cupos</small>
              </div>
              <div>
                <span>Promedio semanal</span>
                <strong>{metrics.avgWeekly.toFixed(1)} h</strong>
                <small>por persona</small>
              </div>
              <div>
                <span>Certificaciones por vencer</span>
                <strong>{metrics.expiringCertifications}</strong>
                <small>próximos 45 días</small>
              </div>
            </div>
          </section>

          <div className="stat-grid stat-grid-compact">
            <Stat label="Cupos requeridos" value={metrics.requiredSlots} hint="En el período completo" icon={CalendarDays} />
            <Stat label="Turnos nocturnos" value={metrics.nightShifts} hint="Asignaciones con recargo nocturno" icon={Clock3} />
            <Stat label="Turnos en festivo" value={metrics.holidayShifts} hint={`${validation.holidays.length} feriado(s) en el período`} icon={CalendarDays} tone={metrics.holidayShifts ? 'warn' : 'ok'} />
            <Stat label="Días con brecha" value={gapDays.length} hint={gapDays.length ? 'Revisa la cobertura diaria' : 'Cobertura completa'} icon={AlertTriangle} tone={gapDays.length ? 'danger' : 'ok'} />
          </div>

          <div className="report-columns">
            <Card title="Cumplimiento semanal" subtitle="Cobertura de cupos por semana ISO.">
              <div className="week-list">
                {(validation.weeks || []).map((week) => {
                  const pct = week.required ? (week.filled / week.required) * 100 : 100;
                  return (
                    <div className="week-row" key={week.weekKey}>
                      <div className="week-row-head">
                        <strong>{week.weekKey}</strong>
                        <span>{formatDateShort(week.startDate)} – {formatDateShort(week.endDate)}</span>
                        <em>{week.filled}/{week.required}</em>
                      </div>
                      <Progress value={pct} tone={pct >= 100 ? 'ok' : 'danger'} />
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card title="Domingos y festivos" subtitle="Impacto del calendario en la operación.">
              <div className="calendar-facts">
                <div>
                  <span>Domingos en el período</span>
                  <strong>{validation.coverage.filter((day) => day.isSunday).length}</strong>
                </div>
                <div>
                  <span>Festivos en el período</span>
                  <strong>{validation.holidays.length}</strong>
                </div>
                <div>
                  <span>Trabajo dominical</span>
                  <Badge tone={scenario.rules.allowSundayWork ? 'warn' : 'ok'}>
                    {scenario.rules.allowSundayWork ? 'Habilitado' : 'Cerrado'}
                  </Badge>
                </div>
                <div>
                  <span>Trabajo en festivos</span>
                  <Badge tone={scenario.rules.allowHolidayWork ? 'warn' : 'ok'}>
                    {scenario.rules.allowHolidayWork ? 'Habilitado' : 'Cerrado'}
                  </Badge>
                </div>
              </div>
              <div className="holiday-list">
                {validation.holidays.length ? (
                  validation.holidays.map((holiday) => (
                    <div className="holiday-item" key={holiday.date}>
                      <span className="holiday-date">{formatDateShort(holiday.date)}</span>
                      <span>{holiday.name}</span>
                      <Badge tone={holiday.type === 'regional' ? 'info' : 'neutral'}>{holiday.type === 'regional' ? 'Regional' : holiday.type === 'custom' ? 'Interno' : 'Nacional'}</Badge>
                    </div>
                  ))
                ) : (
                  <p className="muted">Sin feriados en el período planificado.</p>
                )}
              </div>
              <p className="side-note">Verifica siempre el calendario oficial del año y los feriados regionales de la faena o tienda.</p>
            </Card>
          </div>

          <Card
            title="Hallazgos de cumplimiento"
            subtitle={`${validation.findings.length} hallazgo(s) sobre las reglas configuradas.`}
            actions={
              <div className="filter-row">
                <Filter size={15} />
                {FILTERS.map((filter) => {
                  const count =
                    filter.id === 'all'
                      ? validation.findings.length
                      : validation.findings.filter((finding) => finding.severity === filter.id).length;
                  return (
                    <button
                      key={filter.id}
                      type="button"
                      className={`filter-chip ${severity === filter.id ? 'is-active' : ''}`}
                      onClick={() => setSeverity(filter.id)}
                    >
                      {filter.label} <span>{count}</span>
                    </button>
                  );
                })}
              </div>
            }
          >
            {findings.length ? (
              <div className="finding-list">
                {findings.map((finding) => (
                  <FindingItem key={finding.id} finding={finding} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={CheckCircle2}
                title="Sin hallazgos en este filtro"
                description="Cambia el filtro para revisar otras severidades."
              />
            )}
          </Card>

          <Card title="Cumplimiento por persona" subtitle="Horas, descansos, domingos y noches del período.">
            <div className="table-wrap">
              <table className="data-table report-table">
                <thead>
                  <tr>
                    <th>Trabajador</th>
                    <th className="num">Contrato</th>
                    <th className="num">Horas</th>
                    <th className="num">Prom. semanal</th>
                    <th className="num">Días</th>
                    <th className="num">Dom. trab.</th>
                    <th className="num">Dom. libres</th>
                    <th className="num">Festivos</th>
                    <th className="num">Noches</th>
                    <th className="num">Máx. seg.</th>
                    <th className="num">Máx. noches</th>
                    <th className="num">Descanso mín.</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {(validation.employeeMetrics || []).map((employee) => {
                    const errors = employeeErrors.get(employee.employeeId) || 0;
                    const deviation = employee.contractHours
                      ? ((employee.weeklyAverage - employee.contractHours) / employee.contractHours) * 100
                      : 0;
                    return (
                      <tr key={employee.employeeId}>
                        <td>
                          <strong>{employee.name}</strong>
                          <div className="cell-sub">{employee.role}</div>
                        </td>
                        <td className="num">{employee.contractHours} h</td>
                        <td className="num">{employee.hours.toFixed(1)}</td>
                        <td className="num">
                          {employee.weeklyAverage.toFixed(1)} h
                          {Math.abs(deviation) >= 10 ? (
                            <span className={`deviation ${deviation > 0 ? 'is-over' : 'is-under'}`}>
                              {deviation > 0 ? '+' : ''}{deviation.toFixed(0)}%
                            </span>
                          ) : null}
                        </td>
                        <td className="num">{employee.daysWorked}</td>
                        <td className="num">{employee.sundaysWorked}</td>
                        <td className="num">{employee.sundaysOff}</td>
                        <td className="num">{employee.holidaysWorked}</td>
                        <td className="num">{employee.nights}</td>
                        <td className="num">{employee.maxConsecutive}</td>
                        <td className="num">{employee.maxNightStreak}</td>
                        <td className="num">{employee.minRest === null ? '—' : `${employee.minRest.toFixed(1)} h`}</td>
                        <td>
                          <Badge tone={errors ? 'danger' : 'ok'} dot>{errors ? `${errors} error(es)` : 'OK'}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <details className="coverage-details">
            <summary>
              <span><CalendarDays size={16} /> Detalle de cobertura diaria</span>
              <Badge tone={gapDays.length ? 'danger' : 'ok'}>{gapDays.length ? `${gapDays.length} día(s) con brecha` : 'Sin brechas'}</Badge>
            </summary>
            <div className="table-wrap">
              <table className="data-table coverage-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Día</th>
                    <th className="num">Requeridos</th>
                    <th className="num">Asignados</th>
                    <th className="num">Brecha</th>
                    <th>Detalle por turno</th>
                  </tr>
                </thead>
                <tbody>
                  {validation.coverage.map((day) => (
                    <tr key={day.date} className={day.missing > 0 ? 'row-danger' : ''}>
                      <td>{formatDateShort(day.date)}</td>
                      <td>{day.isSunday ? <Badge tone="warn">Domingo</Badge> : weekdayISO(day.date)}</td>
                      <td className="num">{day.required}</td>
                      <td className="num">{day.assigned}</td>
                      <td className="num">{day.missing || '—'}</td>
                      <td>
                        {day.byShift.map((item) => (
                          <span className="coverage-shift" key={item.shiftId}>
                            {item.shiftName}: {item.assigned}/{item.required}
                          </span>
                        ))}
                        {day.isHoliday ? <Badge tone="info">{day.holidayName}</Badge> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <div className="legal-strip">
            <AlertTriangle size={18} />
            <p><strong>Salvedad legal.</strong> {DISCLAIMER}</p>
          </div>
        </>
      )}
    </div>
  );
}
