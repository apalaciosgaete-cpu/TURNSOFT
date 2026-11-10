import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, RefreshCw, RotateCcw, Scale, ShieldCheck, Sparkles } from 'lucide-react';
import {
  LEGAL_VERSION,
  RULE_CATALOG,
  SECTOR_META,
  nextWeeklyHoursMilestone,
  weeklyHoursAt,
} from '@shared/legal.js';
import { getAllowedDailyHours, getExceptionalAverageLimit, getOrdinaryWeeklyLimit } from '@shared/model.js';
import { useTurnsoft } from '../store/TurnsoftContext.jsx';
import { Badge, Button, Card, Field, Toggle } from '../components/ui.jsx';

const GROUPS = [...new Set(RULE_CATALOG.map((rule) => rule.group))];

export default function Rules() {
  const {
    activeScenario: scenario,
    activeValidation: validation,
    updateRules,
    resetRules,
    generate,
    busyScenarioId,
    isStale,
  } = useTurnsoft();

  if (!scenario) return null;
  const rules = scenario.rules;
  const meta = SECTOR_META[scenario.sector] || SECTOR_META.seguridad;
  const legalWeekly = weeklyHoursAt(scenario.startDate);
  const nextMilestone = nextWeeklyHoursMilestone(scenario.startDate);
  const allowedDaily = getAllowedDailyHours(rules);
  const ordinaryLimit = getOrdinaryWeeklyLimit(rules);
  const exceptionalLimit = getExceptionalAverageLimit(rules);
  const busy = busyScenarioId === scenario.id;
  const stale = isStale(scenario);
  const configuredOverLegal = Number(rules.maxWeeklyHours) > legalWeekly.hours;
  const unauthorizedExceptional = rules.regime === 'excepcional' && !rules.exceptionalAuthorized;

  const rulesByGroup = useMemo(
    () =>
      GROUPS.map((group) => ({
        group,
        rules: RULE_CATALOG.filter((rule) => rule.group === group),
      })),
    []
  );

  const setRule = (id, value) => updateRules(scenario.id, { [id]: Number(value) });

  return (
    <div className="page rules-page">
      <div className="rules-layout">
        <div className="rules-main">
          <Card title="Régimen de jornada" subtitle="Un régimen excepcional solo habilita turnos sobre 10 h si existe autorización vigente.">
            <div className="regime-choice">
              <button
                type="button"
                className={`regime-option ${rules.regime === 'ordinaria' ? 'is-active' : ''}`}
                onClick={() => updateRules(scenario.id, { regime: 'ordinaria' })}
              >
                <strong>Jornada ordinaria</strong>
                <span>Máximo legal semanal y tope diario de 10 h.</span>
              </button>
              <button
                type="button"
                className={`regime-option ${rules.regime === 'excepcional' ? 'is-active' : ''}`}
                onClick={() => updateRules(scenario.id, { regime: 'excepcional' })}
              >
                <strong>Régimen excepcional</strong>
                <span>Turnos de 12 h o ciclos como 4x4 y 7x7, con autorización.</span>
              </button>
            </div>

            {rules.regime === 'excepcional' ? (
              <div className="regime-detail">
                <Toggle
                  checked={rules.exceptionalAuthorized}
                  onChange={(checked) => updateRules(scenario.id, { exceptionalAuthorized: checked })}
                  label="Autorización declarada"
                  description="Marca esta opción solo si la empresa cuenta con la autorización aplicable."
                />
                <Field label="Referencia de la autorización" hint="Resolución, acto administrativo o referencia interna.">
                  <input
                    className="input"
                    value={rules.exceptionalReference || ''}
                    onChange={(event) => updateRules(scenario.id, { exceptionalReference: event.target.value })}
                    placeholder="Res. Ex. 1185/2006 · autorización DT"
                  />
                </Field>
              </div>
            ) : null}

            {unauthorizedExceptional ? (
              <div className="inline-alert inline-alert-danger">
                <AlertTriangle size={17} />
                <span>El escenario usa régimen excepcional sin autorización declarada. Los turnos sobre 10 h se validarán como error.</span>
              </div>
            ) : null}
          </Card>

          {rulesByGroup.map(({ group, rules: groupRules }) => (
            <Card key={group} title={group} subtitle="Parámetros aplicados por el generador y el validador.">
              <div className="rule-grid">
                {groupRules.map((rule) => (
                  <label className="rule-field" key={rule.id}>
                    <span className="rule-field-head">
                      <strong>{rule.label}</strong>
                      <code>{rule.citation}</code>
                    </span>
                    <span className="rule-input-wrap">
                      <input
                        type="number"
                        step={rule.unit === '%' ? '1' : '0.5'}
                        min="0"
                        value={rules[rule.id] ?? 0}
                        onChange={(event) => setRule(rule.id, event.target.value)}
                      />
                      <span className="rule-unit">{rule.unit}</span>
                    </span>
                    <span className="rule-help">{rule.help}</span>
                  </label>
                ))}
              </div>
            </Card>
          ))}

          <Card title="Operación y controles" subtitle="Restricciones de domingo, festivos y exigencias de cobertura.">
            <div className="toggle-stack">
              <Toggle
                checked={rules.allowSundayWork}
                onChange={(checked) => updateRules(scenario.id, { allowSundayWork: checked })}
                label="Trabajo en domingo"
                description="Habilita cobertura los domingos. En actividades no exceptuadas requiere autorización o régimen especial."
              />
              <Toggle
                checked={rules.allowHolidayWork}
                onChange={(checked) => updateRules(scenario.id, { allowHolidayWork: checked })}
                label="Trabajo en festivos"
                description="Si está desactivado, la cobertura se ajusta a cero en feriados nacionales."
              />
              <Toggle
                checked={rules.requireCertifications}
                onChange={(checked) => updateRules(scenario.id, { requireCertifications: checked })}
                label="Exigir certificaciones vigentes"
                description="Bloquea la asignación cuando la credencial está vencida o falta."
              />
              <Toggle
                checked={rules.requireFullCoverage}
                onChange={(checked) => updateRules(scenario.id, { requireFullCoverage: checked })}
                label="Exigir cobertura completa"
                description="Trata los cupos sin cubrir como error; si se desactiva, quedan como advertencia."
              />
            </div>
          </Card>
        </div>

        <aside className="rules-side">
          <Card title="Resumen normativo" subtitle={`Referencia ${LEGAL_VERSION}`}>
            <div className="rule-summary">
              <div className="rule-summary-row">
                <span>Jornada ordinaria vigente</span>
                <strong>{legalWeekly.hours} h</strong>
              </div>
              <div className="rule-summary-row">
                <span>Jornada configurada</span>
                <strong className={configuredOverLegal ? 'text-danger' : ''}>{rules.maxWeeklyHours} h</strong>
              </div>
              <div className="rule-summary-row">
                <span>Tope diario aplicable</span>
                <strong>{allowedDaily} h</strong>
              </div>
              <div className="rule-summary-row">
                <span>{rules.regime === 'excepcional' ? 'Promedio excepcional' : 'Tope semanal ordinario'}</span>
                <strong>{rules.regime === 'excepcional' ? exceptionalLimit : ordinaryLimit} h</strong>
              </div>
              <div className="rule-summary-row">
                <span>Domingos libres al mes</span>
                <strong>{rules.minSundaysOffPerMonth}</strong>
              </div>
              <div className="rule-summary-row">
                <span>Descanso entre jornadas</span>
                <strong>{rules.minRestBetweenShifts} h</strong>
              </div>
            </div>

            {configuredOverLegal ? (
              <div className="inline-alert inline-alert-warn">
                <AlertTriangle size={16} />
                <span>La jornada configurada supera la referencia legal de {legalWeekly.hours} h para la fecha de inicio.</span>
              </div>
            ) : (
              <div className="inline-alert inline-alert-ok">
                <CheckCircle2 size={16} />
                <span>La jornada configurada está dentro de la referencia legal vigente.</span>
              </div>
            )}

            {nextMilestone ? (
              <p className="side-note">
                Próximo hito: <strong>{nextMilestone.hours} h</strong> desde el {nextMilestone.from}. Ajusta tus presets antes de esa fecha.
              </p>
            ) : null}
          </Card>

          {scenario.schedule ? (
            <Card title="Estado del horario actual" subtitle={stale ? 'La configuración cambió desde la última generación.' : 'Generado con la configuración vigente.'}>
              <div className="rule-summary">
                <div className="rule-summary-row">
                  <span>Índice de cumplimiento</span>
                  <strong>{validation.metrics.score}</strong>
                </div>
                <div className="rule-summary-row">
                  <span>Errores</span>
                  <strong className={validation.metrics.errors ? 'text-danger' : ''}>{validation.metrics.errors}</strong>
                </div>
                <div className="rule-summary-row">
                  <span>Advertencias</span>
                  <strong className={validation.metrics.warnings ? 'text-warn' : ''}>{validation.metrics.warnings}</strong>
                </div>
                <div className="rule-summary-row">
                  <span>Cobertura</span>
                  <strong>{Math.round(validation.metrics.coveragePct)}%</strong>
                </div>
              </div>
              <Button
                variant={stale ? 'primary' : 'soft'}
                icon={busy ? RefreshCw : Sparkles}
                onClick={() => generate(scenario.id)}
                disabled={busy}
                className="full-width"
              >
                {busy ? 'Generando…' : stale ? 'Regenerar con estas reglas' : 'Regenerar horario'}
              </Button>
            </Card>
          ) : null}

          <Card title="Acciones" subtitle="Los cambios se guardan automáticamente en este navegador.">
            <div className="side-actions">
              <Button
                variant="soft"
                icon={RotateCcw}
                onClick={() => {
                  if (window.confirm(`¿Restaurar las reglas del sector ${meta.label}?`)) resetRules(scenario.id);
                }}
              >
                Restaurar preset del sector
              </Button>
              <Link to="/legal" className="btn btn-ghost btn-md"><Scale size={17} /> Ver base legal</Link>
            </div>
            <div className="side-disclaimer">
              <ShieldCheck size={16} />
              <p>Estos parámetros son de apoyo. No reemplazan el contrato, el reglamento interno ni la autorización de la Dirección del Trabajo.</p>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
