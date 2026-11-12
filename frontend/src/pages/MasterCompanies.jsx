import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CreditCard,
  Plus,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { SECTOR_META } from '@shared/legal.js';
import { useMaster } from '../store/MasterContext.jsx';
import { dateLabel, money, periodLabel } from '../lib/format.js';
import { Badge, Button, Card, EmptyState, SectorIcon } from '../components/ui.jsx';
import { MasterCompanyModal } from '../components/MasterCompanyModal.jsx';
import { MasterCompanySettings } from '../components/MasterCompanySettings.jsx';
import { MasterPaymentModal } from '../components/MasterPaymentModal.jsx';

export default function MasterCompanies() {
  const { empresas, loading, error, refresh } = useMaster();
  const [query, setQuery] = useState('');
  const [estado, setEstado] = useState('todas');
  const [companyOpen, setCompanyOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [paymentFor, setPaymentFor] = useState('');

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

  const activas = empresas.filter((empresa) => empresa.estado === 'activa').length;
  const suspendidas = empresas.filter((empresa) => empresa.estado === 'suspendida').length;

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
          <div className="master-segmented" role="group" aria-label="Filtrar por estado">
            {[
              { id: 'todas', label: `Todas (${empresas.length})` },
              { id: 'activa', label: `Activas (${activas})` },
              { id: 'suspendida', label: `Bloqueadas (${suspendidas})` },
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
        <Button icon={Plus} onClick={() => setCompanyOpen(true)}>Nueva empresa</Button>
      </div>

      {error ? (
        <div className="master-inline-error">
          <AlertTriangle size={17} />
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={() => refresh()}>Reintentar</Button>
        </div>
      ) : null}

      <Card
        title="Empresas operadoras"
        subtitle="Cada empresa ve únicamente sus clientes, guardias y horarios."
        actions={<Badge tone="info">{filtered.length} de {empresas.length}</Badge>}
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
                  <th>Último pago</th>
                  <th>Estado</th>
                  <th className="actions-col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((empresa) => {
                  const sector = SECTOR_META[empresa.sector] || null;
                  const suspendida = empresa.estado === 'suspendida';
                  return (
                    <tr key={empresa.id}>
                      <td>
                        <div className="master-company-cell">
                          <SectorIcon sector={empresa.sector} meta={sector} size={17} />
                          <div>
                            <strong>{empresa.razon_social}</strong>
                            <span>{empresa.rut_empresa} · {sector?.label || empresa.sector}</span>
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
                          <span><Building2 size={13} /> {empresa.clientes} clientes</span>
                          <span><ShieldCheck size={13} /> {empresa.guardias} guardias</span>
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
                        {empresa.ultimo_pago ? (
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
                        <Badge tone={suspendida ? 'danger' : 'ok'} dot>
                          {suspendida ? 'Bloqueada' : 'Activa'}
                        </Badge>
                        {suspendida ? (
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
            icon={Building2}
            title="Aún no hay empresas"
            description="Crea la primera empresa operadora, define su plan y entrega acceso a su administrador."
            action={<Button icon={Plus} onClick={() => setCompanyOpen(true)}>Crear primera empresa</Button>}
          />
        )}
      </Card>

      <div className="master-note-grid">
        <div className="master-note">
          <ShieldAlert size={18} />
          <div>
            <strong>Bloqueo inmediato</strong>
            <span>Al suspender una empresa, el login y la API rechazan a todos sus usuarios. El cambio se refleja en segundos.</span>
          </div>
        </div>
        <div className="master-note">
          <CreditCard size={18} />
          <div>
            <strong>Pago y reactivación</strong>
            <span>Verifica el pago desde la bandeja de Pagos y marca la reactivación para devolver el acceso.</span>
          </div>
        </div>
        <div className="master-note">
          <ShieldCheck size={18} />
          <div>
            <strong>Planes con límites</strong>
            <span>El servidor valida clientes y guardias según el plan. Puedes ampliar el plan cuando sea necesario.</span>
          </div>
        </div>
      </div>

      <MasterCompanyModal open={companyOpen} onClose={() => setCompanyOpen(false)} />
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
