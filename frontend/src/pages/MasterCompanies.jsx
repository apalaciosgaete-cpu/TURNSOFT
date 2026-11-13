import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CreditCard,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { SECTOR_META } from '@shared/legal.js';
import { useMaster } from '../store/MasterContext.jsx';
import { dateLabel, money, periodLabel, plural } from '../lib/format.js';
import { Badge, Button, Card, EmptyState, SectorIcon } from '../components/ui.jsx';
import { MasterCompanySettings } from '../components/MasterCompanySettings.jsx';
import { MasterPaymentModal } from '../components/MasterPaymentModal.jsx';

function stateTone(estado) {
  if (estado === 'activa') return 'ok';
  if (estado === 'prueba') return 'info';
  if (estado === 'vencida') return 'warn';
  return 'danger';
}

function stateLabel(empresa) {
  if (empresa.estado === 'prueba') return 'En prueba';
  if (empresa.estado === 'vencida') return 'Prueba vencida';
  if (empresa.estado === 'suspendida') return 'Suspendida';
  return 'Activa';
}

export default function MasterCompanies() {
  const { empresas, loading, error, refresh } = useMaster();
  const [query, setQuery] = useState('');
  const [estado, setEstado] = useState('todas');
  const [selected, setSelected] = useState(null);
  const [paymentFor, setPaymentFor] = useState('');

  const counts = useMemo(
    () => ({
      activa: empresas.filter((empresa) => empresa.estado === 'activa').length,
      prueba: empresas.filter((empresa) => empresa.estado === 'prueba').length,
      vencida: empresas.filter((empresa) => empresa.estado === 'vencida').length,
      suspendida: empresas.filter((empresa) => empresa.estado === 'suspendida').length,
    }),
    [empresas]
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return empresas.filter((empresa) => {
      if (estado !== 'todas' && empresa.estado !== estado) return false;
      if (!term) return true;
      return [empresa.razon_social, empresa.rut_empresa, empresa.plan_nombre, empresa.administrador?.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [empresas, query, estado]);

  return (
    <div className="page master-page">
      <div className="master-toolbar">
        <div className="master-toolbar-filters">
          <label className="master-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por empresa, RUT, plan o correo"
            />
          </label>
          <div className="master-segmented master-segmented-wrap" role="group" aria-label="Filtrar por estado">
            {[
              { id: 'todas', label: `Todas (${empresas.length})` },
              { id: 'activa', label: `Activas (${counts.activa})` },
              { id: 'prueba', label: `En prueba (${counts.prueba})` },
              { id: 'vencida', label: `Vencidas (${counts.vencida})` },
              { id: 'suspendida', label: `Suspendidas (${counts.suspendida})` },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                className={estado === option.id ? 'is-active' : ''}
                onClick={() => setEstado(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <Badge tone="info">{filtered.length} de {empresas.length} empresas</Badge>
      </div>

      {error ? (
        <div className="master-inline-error">
          <AlertTriangle size={17} />
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={() => refresh()}>Reintentar</Button>
        </div>
      ) : null}

      <Card
        title="Empresas registradas"
        subtitle="Cada empresa se dio de alta desde el registro público y solo ve su propia operación."
        noPadding
      >
        {loading && !empresas.length ? (
          <div className="master-loading is-compact">
            <span className="master-loading-ring" />
            <div><strong>Cargando empresas…</strong></div>
          </div>
        ) : filtered.length ? (
          <div className="table-wrap">
            <table className="data-table master-table">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Plan</th>
                  <th>Uso</th>
                  <th>Administrador</th>
                  <th>Prueba / último pago</th>
                  <th>Estado</th>
                  <th className="actions-col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((empresa) => {
                  const sector = SECTOR_META[empresa.sector] || null;
                  const enPrueba = empresa.estado === 'prueba';
                  const vencida = empresa.estado === 'vencida';
                  return (
                    <tr key={empresa.id}>
                      <td>
                        <div className="master-company-cell">
                          <SectorIcon sector={empresa.sector} meta={sector} size={17} />
                          <div>
                            <strong>{empresa.razon_social}</strong>
                            <span>{empresa.rut_empresa} · {sector?.label || empresa.sector}</span>
                            {empresa.email_contacto ? <span>{empresa.email_contacto}</span> : null}
                          </div>
                        </div>
                      </td>
                      <td>
                        {empresa.plan_nombre ? (
                          <div className="master-plan-cell">
                            <strong>{empresa.plan_nombre}</strong>
                            <span>{money(empresa.precio_mensual)} / mes</span>
                          </div>
                        ) : (
                          <Badge tone="neutral">Sin plan</Badge>
                        )}
                      </td>
                      <td>
                        <div className="master-usage-cell">
                          <span><Building2 size={13} /> {plural(empresa.clientes, 'cliente', 'clientes')}</span>
                          <span><ShieldCheck size={13} /> {plural(empresa.guardias, 'trabajador', 'trabajadores')}</span>
                          <span><Settings2 size={13} /> {plural(empresa.operadores, 'usuario', 'usuarios')}</span>
                        </div>
                      </td>
                      <td>
                        {empresa.administrador ? (
                          <div className="master-admin-cell">
                            <strong>{empresa.administrador.nombre}</strong>
                            <span>{empresa.administrador.email}</span>
                          </div>
                        ) : (
                          <span className="master-muted">Sin administrador</span>
                        )}
                      </td>
                      <td>
                        {enPrueba || vencida ? (
                          <div className="master-payment-cell">
                            <Badge tone={enPrueba && Number(empresa.dias_prueba) <= 5 ? 'warn' : vencida ? 'danger' : 'info'} dot>
                              {enPrueba
                                ? `${empresa.dias_prueba} día${Number(empresa.dias_prueba) === 1 ? '' : 's'} restantes`
                                : 'Prueba finalizada'}
                            </Badge>
                            <span>
                              {empresa.prueba_fin ? `Termina ${dateLabel(empresa.prueba_fin)}` : 'Sin fecha de término'}
                            </span>
                          </div>
                        ) : empresa.ultimo_pago ? (
                          <div className="master-payment-cell">
                            <Badge
                              tone={
                                empresa.ultimo_pago.estado === 'pagado'
                                  ? 'ok'
                                  : empresa.ultimo_pago.estado === 'vencido'
                                    ? 'danger'
                                    : 'warn'
                              }
                            >
                              {empresa.ultimo_pago.estado}
                            </Badge>
                            <span>{periodLabel(empresa.ultimo_pago.periodo)}</span>
                          </div>
                        ) : (
                          <span className="master-muted">Sin pagos</span>
                        )}
                      </td>
                      <td>
                        <Badge tone={stateTone(empresa.estado)} dot>
                          {stateLabel(empresa)}
                        </Badge>
                        {empresa.estado === 'suspendida' ? (
                          <div className="master-blocked-motivo">{empresa.motivo_bloqueo || 'Falta de pago'}</div>
                        ) : null}
                      </td>
                      <td className="actions-col">
                        <div className="master-row-actions">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={CreditCard}
                            onClick={() => setPaymentFor(empresa.id)}
                          >
                            Pago
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={Settings2}
                            onClick={() => setSelected(empresa)}
                          >
                            Gestionar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : empresas.length ? (
          <EmptyState
            icon={Search}
            title="Sin resultados"
            description="Ajusta la búsqueda o el filtro de estado para encontrar la empresa."
          />
        ) : (
          <EmptyState
            icon={Sparkles}
            title="Aún no hay empresas registradas"
            description="El alta es pública. Cuando una empresa complete el registro, aparecerá aquí con su plan, prueba y ocupación."
          />
        )}
      </Card>

      <div className="master-note-grid">
        <div className="master-note">
          <Sparkles size={18} />
          <div>
            <strong>Registro público</strong>
            <span>Las empresas crean su cuenta y eligen su plan desde la página de registro. El supervisor no da de alta empresas.</span>
          </div>
        </div>
        <div className="master-note">
          <CalendarClock size={18} />
          <div>
            <strong>Prueba de 15 días</strong>
            <span>Al vencer la prueba sin pago, el acceso se bloquea automáticamente y la empresa pasa a estado vencida.</span>
          </div>
        </div>
        <div className="master-note">
          <CreditCard size={18} />
          <div>
            <strong>Pago y activación</strong>
            <span>Verifica el pago desde Pagos. La empresa pasa a activa y todos sus usuarios recuperan el acceso.</span>
          </div>
        </div>
        <div className="master-note">
          <ShieldAlert size={18} />
          <div>
            <strong>Bloqueo manual</strong>
            <span>También puedes suspender una empresa desde Gestionar. El login y la API rechazan a todos sus usuarios.</span>
          </div>
        </div>
        <div className="master-note">
          <ShieldCheck size={18} />
          <div>
            <strong>Planes con límites</strong>
            <span>El servidor valida clientes, usuarios y trabajadores según el plan contratado.</span>
          </div>
        </div>
      </div>

      <MasterCompanySettings
        open={Boolean(selected)}
        empresa={selected}
        onClose={() => setSelected(null)}
      />
      <MasterPaymentModal
        open={Boolean(paymentFor)}
        empresaId={paymentFor}
        onClose={() => setPaymentFor('')}
      />
    </div>
  );
}
