import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Info,
  Search,
  ShieldCheck,
  Scale,
} from 'lucide-react';
import {
  DISCLAIMER,
  LEGAL_SOURCES,
  LEGAL_VERSION,
  RULE_CATALOG,
  SECTOR_META,
  WEEKLY_HOURS_MILESTONES,
  nextWeeklyHoursMilestone,
  weeklyHoursAt,
} from '@shared/legal.js';
import { getSectorRules } from '@shared/presets.js';
import { todayISO } from '@shared/dates.js';
import { Badge, Card, SectorIcon } from '../components/ui.jsx';

const GROUPS = [...new Set(RULE_CATALOG.map((rule) => rule.group))];

export default function Legal() {
  const [query, setQuery] = useState('');
  const today = todayISO();
  const current = weeklyHoursAt(today);
  const next = nextWeeklyHoursMilestone(today);

  const sources = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return LEGAL_SOURCES;
    return LEGAL_SOURCES.filter((source) =>
      [source.norm, source.article, source.title, source.summary, source.relevance, ...(source.tags || [])]
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [query]);

  return (
    <div className="page legal-page">
      <section className="legal-hero">
        <div className="legal-hero-icon"><Scale size={28} /></div>
        <div>
          <Badge tone="info">Referencia {LEGAL_VERSION}</Badge>
          <h2>Reglas claras antes de publicar un turno</h2>
          <p>{DISCLAIMER}</p>
        </div>
        <div className="legal-hero-stats">
          <div>
            <span>Jornada vigente</span>
            <strong>{current.hours} h</strong>
          </div>
          <div>
            <span>Próxima reducción</span>
            <strong>{next ? `${next.hours} h` : '—'}</strong>
            <small>{next ? `desde ${next.from}` : 'sin hitos pendientes'}</small>
          </div>
          <div>
            <span>Fuentes revisadas</span>
            <strong>{LEGAL_SOURCES.length}</strong>
          </div>
        </div>
      </section>

      <Card title="Hitos de la jornada ordinaria" subtitle="Ley 21.561: reducción gradual de 44 a 42 y luego a 40 horas semanales.">
        <div className="milestone-track">
          {WEEKLY_HOURS_MILESTONES.map((milestone) => {
            const isPast = milestone.from <= today && milestone.hours < current.hours;
            const isCurrent = milestone.from <= today && milestone.hours === current.hours;
            const isFuture = milestone.from > today;
            return (
              <div
                key={milestone.from}
                className={`milestone ${isCurrent ? 'is-current' : ''} ${isPast ? 'is-past' : ''} ${isFuture ? 'is-future' : ''}`}
              >
                <div className="milestone-dot">
                  {isCurrent ? <CheckCircle2 size={18} /> : <CalendarClock size={18} />}
                </div>
                <div className="milestone-copy">
                  <strong>{milestone.hours} horas semanales</strong>
                  <span>{milestone.from}</span>
                  <small>{milestone.label}</small>
                </div>
                {isCurrent ? <Badge tone="ok">Vigente</Badge> : isFuture ? <Badge tone="neutral">Próximo</Badge> : <Badge tone="neutral">Histórico</Badge>}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="legal-columns">
        <Card
          title="Fuentes y criterios"
          subtitle="Normas, artículos y referencias usadas para construir los presets."
          actions={
            <div className="search-box search-box-sm">
              <Search size={15} />
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar norma o tema…" />
            </div>
          }
        >
          <div className="source-list">
            {sources.map((source) => (
              <details className="source-card" key={source.id}>
                <summary>
                  <span className="source-norm">{source.norm}</span>
                  <span className="source-title">{source.title}</span>
                  <Badge tone="neutral">{source.article}</Badge>
                </summary>
                <div className="source-body">
                  <p>{source.summary}</p>
                  <div className="source-relevance">
                    <Info size={15} />
                    <p>{source.relevance}</p>
                  </div>
                  <div className="source-foot">
                    <div className="chip-row">
                      {(source.tags || []).map((tag) => (
                        <span className="tag" key={tag}>{tag}</span>
                      ))}
                    </div>
                    <a href={source.url} target="_blank" rel="noreferrer" className="link-inline">
                      Ver referencia <ArrowUpRight size={14} />
                    </a>
                  </div>
                </div>
              </details>
            ))}
            {sources.length === 0 ? <p className="muted">No hay fuentes que coincidan con la búsqueda.</p> : null}
          </div>
        </Card>

        <div className="legal-side">
          <Card title="Alcance y límites" subtitle="Lo que TURNSOFT valida y lo que debes revisar aparte.">
            <ul className="legal-notes">
              <li><strong>Turnos de 12 h:</strong> no son jornada ordinaria. Requieren régimen excepcional autorizado y cumplimiento del DS 48/2023.</li>
              <li><strong>Descanso de 12 h:</strong> es un parámetro contractual/reglamentario de TURNSOFT; el Código del Trabajo no fija un mínimo general de 12 h entre jornadas.</li>
              <li><strong>Recargo dominical:</strong> el 30% es referencia de comercio (art. 38). Otras actividades pueden tener un tratamiento distinto.</li>
              <li><strong>Domingos libres:</strong> la regla de 2 domingos al mes es propia del comercio; no es universal para seguridad o minería.</li>
              <li><strong>Feriados:</strong> se calculan para el período, pero debes verificar el calendario oficial y los feriados regionales aplicables.</li>
              <li><strong>Datos:</strong> esta versión guarda todo en el navegador. No reemplaza nómina, control de asistencia ni fiscalización.</li>
            </ul>
          </Card>

          <Card title="Presets sectoriales" subtitle="Punto de partida editable para cada operación.">
            <div className="sector-legal-list">
              {Object.values(SECTOR_META).map((sector) => {
                const rules = getSectorRules(sector.id);
                return (
                  <div className="sector-legal-item" key={sector.id} style={{ '--sector-color': sector.accent, '--sector-tint': sector.tint }}>
                    <SectorIcon sector={sector.id} meta={sector} size={17} />
                    <div>
                      <strong>{sector.label}</strong>
                      <span>{sector.description}</span>
                      <small>
                        {rules.regime === 'excepcional' ? 'Régimen excepcional' : 'Jornada ordinaria'} · tope {rules.regime === 'excepcional' ? rules.maxExceptionalDailyHours : rules.maxDailyHours} h · {rules.minSundaysOffPerMonth} domingo(s) libre(s)
                      </small>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      <Card title="Catálogo de reglas" subtitle="Cada parámetro indica su fuente o su carácter de política interna.">
        <div className="table-wrap">
          <table className="data-table rules-catalog">
            <thead>
              <tr>
                <th>Grupo</th>
                <th>Regla</th>
                <th>Unidad</th>
                <th>Referencia</th>
                <th>Criterio</th>
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((group) =>
                RULE_CATALOG.filter((rule) => rule.group === group).map((rule, index) => (
                  <tr key={rule.id}>
                    <td>{index === 0 ? <Badge tone="neutral">{group}</Badge> : ''}</td>
                    <td><strong>{rule.label}</strong></td>
                    <td>{rule.unit}</td>
                    <td><code className="inline-code">{rule.citation}</code></td>
                    <td className="rule-help-cell">{rule.help}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="legal-strip">
        <BookOpen size={18} />
        <p>
          <strong>Verificación oficial.</strong> Antes de publicar, contrasta el contrato de trabajo, el reglamento interno, el convenio colectivo, la resolución de la Dirección del Trabajo y el calendario oficial de feriados. TURNSOFT es una herramienta de apoyo y no constituye asesoría legal.
        </p>
      </div>

      <div className="legal-badges">
        <span><ShieldCheck size={15} /> Validación de jornada y descansos</span>
        <span><ShieldCheck size={15} /> Certificaciones y cobertura</span>
        <span><ShieldCheck size={15} /> Exportación CSV / JSON</span>
      </div>
    </div>
  );
}
