import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Plus,
  Search,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { useMaster } from '../store/MasterContext.jsx';
import { currentPeriod, dateLabel, money, periodLabel } from '../lib/format.js';
import { Badge, Button, Card, EmptyState, Stat } from '../components/ui.jsx';
import { MasterPaymentModal } from '../components/MasterPaymentModal.jsx';
import { MasterPaymentVerify } from '../components/MasterPaymentVerify.jsx';

const FILTERS = [
  { id: 'todos', label: 'Todos' },
  { id: 'pendiente', label: 'Pendientes' },
  { id: 'vencido', label: 'Vencidos' },
  { id: 'pagado', label: 'Pagados' },
  { id: 'anulado', label: 'Anulados' },
];

export default function MasterPayments() {
  const { pagos, loading, error, refresh } = useMaster();
  const [filter, setFilter] = useState('pendiente');
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const totals = useMemo(() => {
    const period = currentPeriod();
    return {
      pendientes: pagos.filter((pago) => pago.estado === 'pendiente'),
      vencidos: pagos.filter((pago) => pago.estado === 'vencido'),
      pagadosMes: pagos.filter((pago) => pago.estado === 'pagado' && pago.periodo === period),
    };
  }, [pagos]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return pagos.filter((pago) => {
      if (filter !== 'todos' && pago.estado !== filter) return false;
      if (!term) return true;
      return [pago.razon_social, pago.plan_nombre, pago.referencia]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [pagos, filter, query]);

  const sum = (list) => list.reduce((total, pago) => total + Number(pago.monto || 0), 0);

  return (
    <div className="page master-page">
      <div className="stat-grid master-stat-grid">
        <Stat
          label="Pendientes de verificación"
          value={totals.pendientes.length}
          hint={money(sum(totals.pendientes))}
          icon={CreditCard}
          tone={totals.pendientes.length ? 'warn' : 'default'}
        />
        <Stat
          label="Vencidos"
          value={totals.vencidos.length}
          hint={money(sum(totals.vencidos))}
          icon={AlertTriangle}
          tone={totals.vencidos.length ? 'danger' : 'default'}
        />
        <Stat
          label="Verificados este mes"
          value={totals.pagadosMes.length}
          hint={money(sum(totals.pagadosMes))}
          icon={ShieldCheck}
          tone="ok"
        />
        <Stat
          label="Total registrado"
          value={pagos.length}
          hint="Historial completo de pagos"
          icon={Wallet}
        />
      </div>

      <div className="master-toolbar">
        <div className="master-toolbar-filters">
          <label className="master-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por empresa, plan o referencia"
            />
          </label>
          <div className="master-segmented" role="group" aria-label="Filtrar pagos">
            {FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={filter === option.id ? 'is-active' : ''}
                onClick={() => setFilter(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <Button icon={Plus} onClick={() => setCreateOpen(true)}>Registrar pago</Button>
      </div>

      {error ? (
        <div className="master-inline-error">
          <AlertTriangle size={17} />
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={() => refresh()}>Reintentar</Button>
        </div>
      ) : null}

      <Card
        title="Mensualidades"
        subtitle="Verifica cada pago. Al confirmarlo, la empresa pasa a activa y recupera el acceso."
        actions={
          <Badge tone="info">
            {filtered.length} registro{filtered.length === 1 ? '' : 's'}
          </Badge>
        }
        noPadding
      >
        {loading && !pagos.length ? (
          <div className="master-loading is-compact">
            <span className="master-loading-ring" />
            <div><strong>Cargando pagos…</strong></div>
          </div>
        ) : filtered.length ? (
          <div className="table-wrap">
            <table className="data-table master-table">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Período</th>
                  <th>Monto</th>
                  <th>Vencimiento</th>
                  <th>Estado</th>
                  <th>Método / referencia</th>
                  <th className="actions-col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((pago) => (
                  <tr key={pago.id}>
                    <td>
                      <div className="master-admin-cell">
                        <strong>{pago.razon_social}</strong>
                        <span>{pago.plan_nombre || 'Sin plan'}</span>
                      </div>
                    </td>
                    <td>{periodLabel(pago.periodo)}</td>
                    <td className="num">{money(pago.monto)}</td>
                    <td>
                      {dateLabel(pago.fecha_vencimiento)}
                      {pago.fecha_pago ? (
                        <div className="master-muted">pagado {dateLabel(pago.fecha_pago)}</div>
                      ) : null}
                    </td>
                    <td>
                      <Badge
                        tone={
                          pago.estado === 'pagado'
                            ? 'ok'
                            : pago.estado === 'vencido'
                              ? 'danger'
                              : pago.estado === 'anulado'
                                ? 'neutral'
                                : 'warn'
                        }
                        dot
                      >
                        {pago.estado}
                      </Badge>
                    </td>
                    <td>
                      <div className="master-admin-cell">
                        <strong className="master-capitalize">{pago.metodo || 'Sin método'}</strong>
                        <span>{pago.referencia || '—'}</span>
                      </div>
                    </td>
                    <td className="actions-col">
                      <div className="master-row-actions">
                        {pago.estado === 'pagado' ? (
                          <Button variant="ghost" size="sm" onClick={() => setSelected(pago)}>
                            Ver detalle
                          </Button>
                        ) : (
                          <Button
                            variant={pago.estado === 'vencido' ? 'danger' : 'primary'}
                            size="sm"
                            icon={CheckCircle2}
                            onClick={() => setSelected(pago)}
                          >
                            Verificar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : pagos.length ? (
          <EmptyState
            icon={Search}
            title="Sin pagos en este filtro"
            description="Cambia el filtro de estado o busca por empresa para encontrar el pago."
          />
        ) : (
          <EmptyState
            icon={CreditCard}
            title="Aún no hay pagos registrados"
            description="Los pagos aparecen al completar el registro público de una empresa. También puedes registrar una mensualidad manualmente."
            action={<Button icon={Plus} onClick={() => setCreateOpen(true)}>Registrar pago</Button>}
          />
        )}
      </Card>

      <div className="master-note-grid">
        <div className="master-note">
          <Wallet size={18} />
          <div>
            <strong>Registro manual</strong>
            <span>El pago nace como pendiente. Puedes anotar método, referencia y vencimiento.</span>
          </div>
        </div>
        <div className="master-note">
          <CheckCircle2 size={18} />
          <div>
            <strong>Verificación y activación</strong>
            <span>Al marcar un pago como pagado, queda registrado quién lo verificó y la empresa pasa a activa automáticamente.</span>
          </div>
        </div>
        <div className="master-note">
          <ShieldCheck size={18} />
          <div>
            <strong>Prueba vencida o suspendida</strong>
            <span>La verificación del pago devuelve el acceso a todos los usuarios en el mismo paso, sin esperar otro cambio.</span>
          </div>
        </div>
      </div>

      <MasterPaymentModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <MasterPaymentVerify
        open={Boolean(selected)}
        pago={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
