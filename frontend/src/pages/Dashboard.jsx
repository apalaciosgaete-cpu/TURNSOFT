import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Circle,
  Clock3,
  Contact,
  Copy,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { SECTOR_META, DISCLAIMER } from '@shared/legal.js';
import { getHolidayMap } from '@shared/holidays.js';
import { getTotalRequiredSlots } from '@shared/model.js';
import { eachDate, formatDateShort, formatRange, weekdayISO, WEEKDAYS_SHORT } from '@shared/dates.js';
import { apiRequest, useAuth } from '../store/AuthContext.jsx';
import { useTurnsoft } from '../store/TurnsoftContext.jsx';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  FindingItem,
  Ring,
  SectorIcon,
  Stat,
} from '../components/ui.jsx';
import { ScenarioModal } from '../components/ScenarioModal.jsx';

function scoreTone(score) {
  if (score >= 90) return '#1d4ed8';
  if (score >= 70) return '#b45309';
  return '#b91c1c';
}

function StartHome() {
  const { session, isOperator, readOnly, token } = useAuth();
  const [scenarioOpen, setScenarioOpen] = useState(false);
  // Cuántos trabajadores ya tiene la empresa cargados (null mientras se consulta).
  const [workerCount, setWorkerCount] = useState(null);

  const trackBase = isOperator && !readOnly;

  useEffect(() => {
    if (!trackBase || !token) return undefined;
    let cancelled = false;
    apiRequest('/guardias', { token })
      .then((lista) => {
        if (!cancelled) setWorkerCount(Array.isArray(lista) ? lista.filter((item) => item.activo !== false).length : 0);
      })
      .catch(() => {
        if (!cancelled) setWorkerCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [trackBase, token]);

  const hasWorkers = (workerCount || 0) > 0;
  const steps = [
    { title: 'Cuenta de la empresa', detail: 'Empresa y acceso configurados', done: true },
    ...(trackBase
      ? [
          {
            title: 'Tus trabajadores',
            detail: hasWorkers
              ? `${workerCount} trabajador${workerCount === 1 ? '' : 'es'} en la base`
              : 'Regístralos una sola vez',
            done: hasWorkers,
            active: !hasWorkers && workerCount !== null,
          },
        ]
      : []),
    {
      title: 'Tu primera planificación',
      detail: 'El período a programar, por ejemplo un mes',
      done: false,
      active: !trackBase || hasWorkers,
    },
    { title: 'Tu primer horario', detail: 'Se genera y se valida contra la ley', done: false },
  ];
  const completed = steps.filter((step) => step.done).length;

  const needsWorkers = trackBase && workerCount === 0;

  return (
    <div className="page start-home">
      <section className="start-hero">
        <div className="start-hero-copy">
          <span className="start-eyebrow">
            <Sparkles size={15} /> Primeros pasos
          </span>
          <h1>
            {readOnly
              ? 'Aún no hay planificaciones.'
              : session?.empresa
                ? `Armemos el primer horario de ${session.empresa}.`
                : 'Armemos tu primer horario.'}
          </h1>
          <p>
            {readOnly
              ? 'Cuando el administrador cree la primera planificación y genere el horario, podrás revisarlo y aprobarlo desde aquí.'
              : needsWorkers
                ? 'Primero registra a tu personal. Luego defines el período que quieres programar y TURNSOFT propone los turnos respetando la ley; tú ajustas lo que necesites.'
                : 'Define el período que quieres programar, por ejemplo un mes. TURNSOFT propone los turnos respetando la ley y tú ajustas lo que necesites.'}
          </p>
          {readOnly ? null : (
            <div className="start-actions">
              {needsWorkers ? (
                <>
                  <Link className="btn btn-primary btn-md" to="/trabajadores">
                    <Contact size={17} /> Cargar mis trabajadores
                  </Link>
                  <Button variant="soft" icon={CalendarRange} onClick={() => setScenarioOpen(true)}>
                    Crear planificación
                  </Button>
                </>
              ) : (
                <>
                  <Button icon={CalendarRange} onClick={() => setScenarioOpen(true)}>
                    Crear primera planificación
                  </Button>
                  {trackBase ? (
                    <Link className="btn btn-ghost btn-md" to="/trabajadores">
                      Ver mis trabajadores
                    </Link>
                  ) : null}
                </>
              )}
            </div>
          )}
        </div>

        <div className="start-progress-card">
          <div className="start-progress-head">
            <span>Configuración inicial</span>
            <strong>{completed} de {steps.length}</strong>
          </div>
          <div className="start-progress-track" aria-hidden="true">
            <span style={{ width: `${(completed / steps.length) * 100}%` }} />
          </div>
          <ul className="start-progress-list">
            {steps.map((step) => (
              <li key={step.title} className={step.done ? 'is-done' : step.active ? 'is-active' : ''}>
                {step.done ? <CheckCircle2 size={17} /> : <Circle size={17} />}
                <div>
                  <strong>{step.title}</strong>
                  <span>{step.detail}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="start-section" id="primeros-pasos">
        <div className="start-section-head">
          <div>
            <h2>Tres pasos para tu primer horario</h2>
            <p>No tienes que configurar todo de una vez: puedes volver a ajustar cada paso.</p>
          </div>
        </div>
        <div className="start-step-grid">
          <article className="start-step-card">
            <span className="start-step-icon"><Contact size={20} /></span>
            <Badge tone="info">Paso 1</Badge>
            <h3>Trabajadores</h3>
            <p>Registra a tu personal una sola vez. Queda en la base de tu empresa para todas tus planificaciones.</p>
          </article>
          <article className="start-step-card">
            <span className="start-step-icon"><CalendarRange size={20} /></span>
            <Badge tone="info">Paso 2</Badge>
            <h3>Planificación</h3>
            <p>Elige el período y el sector. Traes a tu personal y tus turnos con un clic y puedes ajustar las reglas antes de generar.</p>
          </article>
          <article className="start-step-card">
            <span className="start-step-icon"><ShieldCheck size={20} /></span>
            <Badge tone="info">Paso 3</Badge>
            <h3>Horario validado</h3>
            <p>Genera la propuesta y revisa cobertura, descansos y cumplimiento legal. Tú decides qué cambiar.</p>
          </article>
        </div>
      </section>

      <ScenarioModal open={scenarioOpen} onClose={() => setScenarioOpen(false)} />
    </div>
  );
}

export default function Dashboard() {
  const {
    activeScenario: scenario,
    activeValidation: validation,
    scenarios,
    activeScenarioId,
    selectScenario,
    generate,
    busyScenarioId,
    duplicateScenario,
    deleteScenario,
    validationFor,
  } = useTurnsoft();
  const [editing, setEditing] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  const meta = SECTOR_META[scenario?.sector] || SECTOR_META.seguridad;
  const metrics = validation?.metrics;
  const hasSchedule = Boolean(scenario?.schedule);
  const busy = busyScenarioId === scenario?.id;

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

  const upcoming = useMemo(() => {
    if (!scenario) return [];
    const dates = eachDate(scenario.startDate, Math.min(16, scenario.days));
    const coverageByDate = new Map((validation?.coverage || []).map((item) => [item.date, item]));
    return dates.map((date) => {
      const required = getTotalRequiredSlots(scenario, date, holidayMap);
      const coverage = coverageByDate.get(date);
      return {
        date,
        weekday: weekdayISO(date),
        required,
        assigned: coverage ? coverage.assigned : 0,
        holiday: holidayMap[date]?.name || '',
      };
    });
  }, [scenario, validation, holidayMap]);

  const scenarioSummaries = useMemo(
    () =>
      scenarios.map((item) => {
        const report = validationFor(item);
        return {
          scenario: item,
          meta: SECTOR_META[item.sector] || SECTOR_META.seguridad,
          score: item.schedule ? report.metrics.score : null,
          errors: report.metrics.errors,
          coverage: item.schedule ? report.metrics.coveragePct : null,
          staff: (item.employees || []).filter((employee) => employee.active !== false).length,
        };
      }),
    [scenarios, validationFor]
  );

  if (!scenario) return <StartHome />;

  const topFindings = (validation?.findings || [])
    .filter((finding) => finding.severity !== 'info')
    .slice(0, 4);

  return (
    <div className="page dashboard">
      <section className="hero-panel">
        <div className="hero-main">
          <div className="hero-heading">
            <SectorIcon sector={scenario.sector} meta={meta} size={26} />
            <div>
              <div className="hero-eyebrow">
                <Badge tone="sector">{meta.label}</Badge>
                <span>{formatRange(scenario.startDate, scenario.days)}</span>
                <span>{scenario.days} días</span>
              </div>
              <h2>{scenario.name}</h2>
              <p className="hero-company">{[scenario.company, scenario.location].filter(Boolean).join(' · ')}</p>
            </div>
          </div>

          <p className="hero-notes">{scenario.notes || 'Sin notas para esta planificación.'}</p>

          <div className="hero-tags">
            <span className="hero-tag"><Users size={14} /> {metrics?.activeEmployees ?? scenario.employees.length} personas activas</span>
            <span className="hero-tag"><Clock3 size={14} /> {scenario.shifts.length} turnos</span>
            <span className="hero-tag"><ShieldCheck size={14} /> {scenario.rules.regime === 'excepcional' ? 'Régimen excepcional' : 'Jornada ordinaria'}</span>
            <span className="hero-tag"><CalendarDays size={14} /> Patrón {scenario.pattern}</span>
          </div>

          <div className="hero-actions">
            <Button icon={Sparkles} onClick={() => generate(scenario.id)} disabled={busy} className={busy ? 'is-busy' : ''}>
              {busy ? 'Generando…' : hasSchedule ? 'Regenerar horario' : 'Generar horario'}
            </Button>
            <Link to="/horario" className="btn btn-soft btn-md">
              <CalendarDays size={17} strokeWidth={2.2} />
              <span>Ver horario</span>
            </Link>
            <Button variant="ghost" icon={Pencil} onClick={() => setEditing(scenario)}>Editar datos</Button>
          </div>
        </div>

        <div className="hero-score">
          <Ring value={hasSchedule ? metrics.score : 0} label={hasSchedule ? 'de 100' : 'sin horario'} tone={scoreTone(hasSchedule ? metrics.score : 0)} size={148} />
          <div className="hero-score-caption">
            <strong>{hasSchedule ? 'Índice de cumplimiento' : 'Aún sin horario'}</strong>
            <span>
              {hasSchedule
                ? metrics.errors > 0
                  ? `${metrics.errors} error(es) por revisar`
                  : metrics.warnings > 0
                    ? `${metrics.warnings} advertencia(s), sin errores`
                    : 'Sin hallazgos críticos'
                : 'Genera el horario para validar las reglas'}
            </span>
          </div>
        </div>
      </section>

      <div className="stat-grid">
        <Stat
          label="Cobertura de cupos"
          value={hasSchedule ? `${Math.round(metrics.coveragePct)}%` : '—'}
          hint={hasSchedule ? `${metrics.filledSlots} de ${metrics.requiredSlots} cupos cubiertos` : 'Se calcula al generar'}
          icon={CheckCircle2}
          tone={hasSchedule && metrics.coveragePct < 100 ? 'warn' : 'ok'}
        />
        <Stat
          label="Promedio semanal"
          value={hasSchedule ? `${metrics.avgWeekly.toFixed(1)} h` : '—'}
          hint="Por persona, sobre el período planificado"
          icon={Clock3}
          tone={hasSchedule && metrics.avgWeekly > scenario.rules.maxWeeklyHours ? 'danger' : 'default'}
        />
        <Stat
          label="Personal activo"
          value={metrics?.activeEmployees ?? scenario.employees.filter((employee) => employee.active !== false).length}
          hint={`${scenario.shifts.length} turnos configurados`}
          icon={Users}
        />
        <Stat
          label="Hallazgos"
          value={hasSchedule ? metrics.errors + metrics.warnings : '—'}
          hint={hasSchedule ? `${metrics.errors} errores · ${metrics.warnings} advertencias` : 'Sin validación todavía'}
          icon={AlertTriangle}
          tone={hasSchedule && metrics.errors > 0 ? 'danger' : hasSchedule && metrics.warnings > 0 ? 'warn' : 'ok'}
        />
      </div>

      <div className="dashboard-columns">
        <Card
          title="Próximos días"
          subtitle="Cobertura requerida y asignada. Los feriados se calculan para el período."
          actions={<Link to="/horario" className="link-inline">Abrir grilla <ArrowRight size={14} /></Link>}
          className="days-card"
        >
          <div className="day-strip">
            {upcoming.map((day) => {
              const complete = hasSchedule && day.assigned >= day.required;
              const empty = hasSchedule && day.assigned === 0 && day.required > 0;
              return (
                <div
                  key={day.date}
                  className={`day-chip ${day.weekday === 7 ? 'is-sunday' : ''} ${day.holiday ? 'is-holiday' : ''} ${complete ? 'is-complete' : ''} ${empty ? 'is-empty' : ''}`}
                  title={day.holiday || undefined}
                >
                  <span className="day-chip-weekday">{WEEKDAYS_SHORT[day.weekday - 1]}</span>
                  <strong>{Number(day.date.slice(8, 10))}</strong>
                  <span className="day-chip-count">
                    {hasSchedule ? `${day.assigned}/${day.required}` : `${day.required} cupos`}
                  </span>
                  {day.holiday ? <span className="day-chip-holiday" title={day.holiday}>F</span> : null}
                </div>
              );
            })}
          </div>
          <div className="day-strip-foot">
            <span><i className="dot dot-ok" /> Cubierto</span>
            <span><i className="dot dot-warn" /> Incompleto</span>
            <span><i className="dot dot-danger" /> Sin asignación</span>
            <span><i className="dot dot-holiday" /> Feriado</span>
            <span className="day-strip-range">{formatDateShort(upcoming[0]?.date || scenario.startDate)} – {formatDateShort(upcoming[upcoming.length - 1]?.date || scenario.startDate)}</span>
          </div>
        </Card>

        <Card
          title="Alertas de cumplimiento"
          subtitle="Priorizadas por severidad."
          actions={<Link to="/reportes" className="link-inline">Ver todas <ArrowRight size={14} /></Link>}
          className="alerts-card"
        >
          {!hasSchedule ? (
            <EmptyState
              icon={Sparkles}
              title="Genera el primer horario"
              description="El motor asignará la dotación respetando jornada, descansos, domingos y certificaciones."
              action={<Button icon={Sparkles} onClick={() => generate(scenario.id)}>Generar ahora</Button>}
            />
          ) : topFindings.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Sin hallazgos críticos"
              description="El horario cumple las reglas configuradas. Revisa igualmente el contrato y las autorizaciones aplicables."
            />
          ) : (
            <div className="finding-list">
              {topFindings.map((finding) => (
                <FindingItem key={finding.id} finding={finding} compact />
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card
        title="Mis planificaciones"
        subtitle="Cada planificación es un período a programar (por ejemplo, un mes). Cambia entre ellas sin perder nada."
        actions={<Button variant="soft" size="sm" icon={Plus} onClick={() => setCreateOpen(true)}>Nueva planificación</Button>}
      >
        <div className="scenario-grid">
          {scenarioSummaries.map(({ scenario: item, meta: itemMeta, score, errors, coverage, staff }) => (
            <article
              key={item.id}
              className={`scenario-card ${item.id === activeScenarioId ? 'is-active' : ''}`}
              style={{ '--sector-color': itemMeta.accent, '--sector-tint': itemMeta.tint }}
            >
              <div className="scenario-card-top">
                <SectorIcon sector={item.sector} meta={itemMeta} size={19} />
                <Badge tone="sector">{itemMeta.short}</Badge>
                {item.id === activeScenarioId ? <Badge tone="ok" dot>Activo</Badge> : null}
                <div className="scenario-card-menu">
                  <button type="button" className="icon-btn" title="Editar datos" onClick={() => setEditing(item)}><Pencil size={15} /></button>
                  <button type="button" className="icon-btn" title="Duplicar" onClick={() => duplicateScenario(item.id)}><Copy size={15} /></button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    title="Eliminar"
                    onClick={() => {
                      if (window.confirm(`¿Eliminar la planificación "${item.name}"?`)) deleteScenario(item.id);
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <h3>{item.name}</h3>
              <p>{item.company} · {staff} personas</p>
              <div className="scenario-card-stats">
                <div>
                  <span>Cobertura</span>
                  <strong>{coverage === null ? '—' : `${Math.round(coverage)}%`}</strong>
                </div>
                <div>
                  <span>Cumplimiento</span>
                  <strong className={score !== null && score < 90 ? 'text-warn' : ''}>{score === null ? '—' : score}</strong>
                </div>
                <div>
                  <span>Errores</span>
                  <strong className={errors > 0 ? 'text-danger' : ''}>{item.schedule ? errors : '—'}</strong>
                </div>
              </div>
              <div className="scenario-card-foot">
                <button
                  type="button"
                  className="scenario-switch"
                  onClick={() => selectScenario(item.id)}
                  disabled={item.id === activeScenarioId}
                >
                  {item.id === activeScenarioId ? 'En uso' : 'Abrir planificación'}
                </button>
                <span>{item.days} días</span>
              </div>
            </article>
          ))}

          <button type="button" className="scenario-add-card" onClick={() => setCreateOpen(true)}>
            <span className="scenario-add-icon"><Plus size={22} /></span>
            <strong>Crear planificación</strong>
            <span>Un nuevo período, con tu personal y tus turnos</span>
          </button>
        </div>
      </Card>

      <div className="legal-strip">
        <ShieldCheck size={18} />
        <p>
          <strong>Salvedad legal.</strong> {DISCLAIMER}
        </p>
      </div>

      <ScenarioModal
        open={createOpen || Boolean(editing)}
        scenario={editing}
        onClose={() => {
          setEditing(null);
          setCreateOpen(false);
        }}
      />
    </div>
  );
}
