import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  CreditCard,
  Headphones,
  Plus,
  ShieldAlert,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useMaster } from '../store/MasterContext.jsx';
import { dateLabel, money, periodLabel, relativeTime } from '../lib/format.js';
import { Badge, Button, Card, EmptyState, Stat } from '../components/ui.jsx';
import { MasterCompanyModal } from '../components/MasterCompanyModal.jsx';
import { MasterPaymentModal } from '../components/MasterPaymentModal.jsx';

export default function MasterOverview() {
  const { resumen, loading, error, refresh } = useMaster();
  const [companyOpen, setCompanyOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  if (loading && !resumen) {
    return (
      <div className="page master-page">
        <div className="master-loading">
          <span className="master-loading-ring" />
          <div>
            <strong>Cargando la consola maestra…</strong>
            <p>Consultando empresas, pagos y soporte.</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !resumen) {
    return (
      <div className="page master-page">
        <div className="master-error">
          <AlertTriangle size={26} />
          <div>
            <strong>No se pudo cargar el resumen</strong>
            <p>{error}</p>
          </div>
          <Button variant="secondary" onClick={() => refresh()}>Reintentar</Button>
        </div>
      </div>
    );
  }

  const empresasAtencion = resumen?.empresas_atencion || [];
  const pagosPendientes = resumen?.pagos_por_verificar || [];
  const tickets = resumen?.tickets_recientes || [];

  return (
    <div className="page master-page">
      <section className="master-hero">
        <div className="master-hero-copy">
          <span className="master-hero-eyebrow">
            <ShieldAlert size={15} /> Plataforma multiempresa
          </span>
          <h2>Control total de TURNSOFT, en una sola consola.</h2>
          <p>
            Supervisa el alta de empresas, el estado de los pagos, los bloqueos
            por no pago y las solicitudes de soporte de cada cliente.
          </p>
          <div className="master-hero-actions">
            <Button icon={Plus} onClick={() => setCompanyOpen(true)}>Nueva empresa</Button>
            <Button variant="secondary" icon={CreditCard} onClick={() => setPaymentOpen(true)}>
              Registrar pago
            </Button>
          </div>
        </div>
        <div className="master-hero-side">
          <div className="master-hero-metric">
            <span>Ingresos verificados del mes</span>
            <strong>{money(resumen?.ingresos_mes || 0)}</strong>
            <small>Pagos marcados como pagados en el período actual.</small>
          </div>
          <div className="master-hero-metric is-accent">
            <span>MRR de empresas activas</span>
            <strong>{money(resumen?.mrr || 0)}</strong>
            <small>{resumen?.activas || 0} empresas con plan vigente.</small>
          </div>
        </div>
      </section>

      <div className="stat-grid master-stat-grid">
        <Stat
          label="Empresas activas"
          value={resumen?.activas ?? 0}
          hint={`${resumen?.empresas ?? 0} empresas en total`}
          icon={Building2}
          tone="ok"
        />
        <Stat
          label="Empresas suspendidas"
          value={resumen?.suspendidas ?? 0}
          hint={resumen?.suspendidas ? 'Acceso bloqueado por pago' : 'Sin bloqueos vigentes'}
          icon={ShieldAlert}
          tone={resumen?.suspendidas ? 'danger' : 'default'}
        />
        <Stat
          label="Pagos pendientes"
          value={resumen?.pagos_pendientes ?? 0}
          hint="Por verificar o cobrar"
          icon={CreditCard}
          tone={resumen?.pagos_pendientes ? 'warn' : 'default'}
        />
        <Stat
          label="Monto vencido"
          value={money(resumen?.monto_vencido || 0)}
          hint={`${resumen?.pagos_vencidos ?? 0} pagos vencidos`}
          icon={AlertTriangle}
          tone={resumen?.pagos_vencidos ? 'danger' : 'default'}
        />
        <Stat
          label="Clientes gestionados"
          value={resumen?.clientes ?? 0}
          hint="Mandantes en todas las empresas"
          icon={Users}
        />
        <Stat
          label="Tickets abiertos"
          value={resumen?.tickets_abiertos ?? 0}
          hint="Solicitudes de soporte sin resolver"
          icon={Headphones}
          tone={resumen?.tickets_abiertos ? 'warn' : 'default'}
        />
      </div>

      <div className="master-columns">
        <Card
          title="Empresas que requieren atención"
          subtitle="Suspendidas o con pagos vencidos."
          actions={<Link className="btn btn-ghost btn-sm" to="/master/empresas">Ver todas <ArrowRight size={15} /></Link>}
        >
          {empresasAtencion.length ? (
            <ul className="master-list">
              {empresasAtencion.map((empresa) => (
                <li key={empresa.id}>
                  <span className={`master-list-icon ${empresa.estado === 'suspendida' ? 'is-danger' : 'is-warn'}`}>
                    <Building2 size={17} />
                  </span>
                  <div className="master-list-body">
                    <strong>{empresa.razon_social}</strong>
                    <span>
                      {empresa.plan_nombre || 'Sin plan'}
                      {empresa.ultimo_periodo
                        ? ` · ${periodLabel(empresa.ultimo_periodo)}: ${empresa.ultimo_pago_estado}`
                        : ' · sin pagos registrados'}
                    </span>
                  </div>
                  <Badge tone={empresa.estado === 'suspendida' ? 'danger' : 'warn'} dot>
                    {empresa.estado === 'suspendida' ? 'Bloqueada' : 'Pago vencido'}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={CheckCircle2}
              title="Todo al día"
              description="No hay empresas bloqueadas ni pagos vencidos pendientes de revisión."
            />
          )}
        </Card>

        <Card
          title="Pagos por verificar"
          subtitle="Pendientes y vencidos, ordenados por urgencia."
          actions={<Link className="btn btn-ghost btn-sm" to="/master/pagos">Ver pagos <ArrowRight size={15} /></Link>}
        >
          {pagosPendientes.length ? (
            <ul className="master-list">
              {pagosPendientes.map((pago) => (
                <li key={pago.id}>
                  <span className={`master-list-icon ${pago.estado === 'vencido' ? 'is-danger' : 'is-warn'}`}>
                    <CreditCard size={17} />
                  </span>
                  <div className="master-list-body">
                    <strong>{pago.razon_social}</strong>
                    <span>{periodLabel(pago.periodo)} · {money(pago.monto)}</span>
                  </div>
                  <div className="master-list-side">
                    <Badge tone={pago.estado === 'vencido' ? 'danger' : 'warn'}>{pago.estado}</Badge>
                    <small>vence {dateLabel(pago.fecha_vencimiento)}</small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={CheckCircle2}
              title="Sin pagos pendientes"
              description="Todos los pagos registrados están verificados o anulados."
            />
          )}
        </Card>

        <Card
          title="Soporte reciente"
          subtitle="Tickets abiertos o en revisión."
          actions={<Link className="btn btn-ghost btn-sm" to="/master/soporte">Ver soporte <ArrowRight size={15} /></Link>}
        >
          {tickets.length ? (
            <ul className="master-list">
              {tickets.map((ticket) => (
                <li key={ticket.id}>
                  <span className={`master-list-icon ${ticket.prioridad === 'urgente' ? 'is-danger' : 'is-info'}`}>
                    <Headphones size={17} />
                  </span>
                  <div className="master-list-body">
                    <strong>{ticket.asunto}</strong>
                    <span>{ticket.razon_social} · {relativeTime(ticket.creado_en)}</span>
                  </div>
                  <Badge tone={ticket.prioridad === 'urgente' ? 'danger' : ticket.prioridad === 'alta' ? 'warn' : 'neutral'}>
                    {ticket.prioridad}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={CheckCircle2}
              title="Sin tickets abiertos"
              description="Las empresas no tienen solicitudes de soporte pendientes."
            />
          )}
        </Card>

        <Card
          title="Cómo funciona la consola"
          subtitle="Tu operación como supervisor maestro."
        >
          <ol className="master-steps">
            <li>
              <span>1</span>
              <div>
                <strong>Crea la empresa y su administrador</strong>
                <p>Define razón social, sector, plan y día de cobro. La empresa queda aislada de las demás.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Registra y verifica pagos</strong>
                <p>Cada mensualidad se aprueba manualmente. Al verificarla puedes reactivar la empresa.</p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Bloquea por no pago</strong>
                <p>El acceso de todos los usuarios de la empresa se rechaza de inmediato en login y API.</p>
              </div>
            </li>
            <li>
              <span>4</span>
              <div>
                <strong>Responde soporte y ajusta planes</strong>
                <p>Amplía cupos cuando la empresa lo necesite, sin tocar sus datos operativos.</p>
              </div>
            </li>
          </ol>
          <div className="master-tip">
            <TrendingUp size={16} />
            <span>El MRR se calcula con el precio de los planes de las empresas activas.</span>
          </div>
        </Card>
      </div>

      <MasterCompanyModal open={companyOpen} onClose={() => setCompanyOpen(false)} />
      <MasterPaymentModal open={paymentOpen} onClose={() => setPaymentOpen(false)} />
    </div>
  );
}
