import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Headphones,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import { useMaster } from '../store/MasterContext.jsx';
import { dateLabel, money, periodLabel, plural, relativeTime } from '../lib/format.js';
import { Badge, Card, EmptyState, Progress, Stat } from '../components/ui.jsx';

const STATE_ROWS = [
  { key: 'activas', label: 'Activas', tone: 'ok' },
  { key: 'en_prueba', label: 'En prueba', tone: 'info' },
  { key: 'pruebas_por_vencer', label: 'Por vencer (5 días)', tone: 'warn' },
  { key: 'pruebas_vencidas', label: 'Prueba vencida', tone: 'danger' },
  { key: 'suspendidas', label: 'Suspendidas', tone: 'neutral' },
];

export default function MasterOverview() {
  const { resumen, empresas, loading, error, refresh } = useMaster();

  if (loading && !resumen) {
    return (
      <div className="page master-page">
        <div className="master-loading">
          <span className="master-loading-ring" />
          <div>
            <strong>Cargando la ocupación de la plataforma…</strong>
            <p>Consultando empresas, pruebas, pagos y soporte.</p>
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
          <button type="button" className="btn btn-secondary btn-md" onClick={() => refresh()}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const total = Number(resumen?.empresas || 0);
  const enPrueba = Number(resumen?.en_prueba || 0);
  const porVencer = Number(resumen?.pruebas_por_vencer || 0);
  const activas = Number(resumen?.activas || 0);
  const pruebasVencidas = Number(resumen?.pruebas_vencidas || 0);
  const suspendidas = Number(resumen?.suspendidas || 0);
  const trabajadores = Number(resumen?.guardias || 0);
  const capacidadGuardias = Number(resumen?.capacidad_guardias || 0);
  const ocupacionTrabajadores = capacidadGuardias
    ? Math.round((trabajadores / capacidadGuardias) * 100)
    : null;

  const pruebas = empresas
    .filter((empresa) => empresa.estado === 'prueba')
    .sort((a, b) => Number(a.dias_prueba || 0) - Number(b.dias_prueba || 0))
    .slice(0, 5);

  const recientes = resumen?.empresas_recientes || [];
  const empresasAtencion = resumen?.empresas_atencion || [];
  const pagosPendientes = resumen?.pagos_por_verificar || [];
  const ticketsRecientes = resumen?.tickets_recientes || [];
  const hasEmpresas = total > 0;

  return (
    <div className="page master-page">
      <section className="master-hero master-hero-occupancy">
        <div className="master-hero-copy">
          <span className="master-hero-eyebrow">
            <Activity size={15} /> Ocupación de la plataforma
          </span>
          <h2>Lo que está habitando TURNSOFT, en tiempo real.</h2>
          <p>
            Empresas que se registran solas, pruebas que avanzan, pagos que se
            verifican y soporte que espera respuesta. Esta consola solo supervisa:
            el alta de empresas es pública.
          </p>
          <div className="master-hero-actions">
            <Link className="btn btn-primary btn-md" to="/master/empresas">
              <Building2 size={17} />
              Ver empresas
            </Link>
            <Link className="btn btn-secondary btn-md" to="/master/pagos">
              <Wallet size={17} />
              Revisar pagos
            </Link>
          </div>
        </div>
        <div className="master-hero-side">
          <div className="master-hero-metric">
            <span>Empresas en la plataforma</span>
            <strong>{total}</strong>
            <small>{plural(resumen?.nuevas_mes || 0, 'nueva', 'nuevas')} este mes · {activas} activas</small>
          </div>
          <div className="master-hero-metric is-accent">
            <span>En período de prueba</span>
            <strong>{enPrueba}</strong>
            <small>
              {porVencer} {porVencer === 1 ? 'vence' : 'vencen'} dentro de 5 días ·{' '}
              {pruebasVencidas} ya {pruebasVencidas === 1 ? 'venció' : 'vencieron'}
            </small>
          </div>
        </div>
      </section>

      <div className="stat-grid master-stat-grid">
        <Stat
          label="Empresas registradas"
          value={total}
          hint={`${plural(resumen?.nuevas_mes || 0, 'nueva', 'nuevas')} este mes`}
          icon={Building2}
        />
        <Stat
          label="En prueba"
          value={enPrueba}
          hint={`${porVencer} por vencer en 5 días`}
          icon={Sparkles}
          tone={enPrueba ? 'warn' : 'default'}
        />
        <Stat
          label="Activas"
          value={activas}
          hint={plural(suspendidas, 'suspendida', 'suspendidas')}
          icon={ShieldCheck}
          tone="ok"
        />
        <Stat
          label="Ingresos del mes"
          value={money(resumen?.ingresos_mes || 0)}
          hint="Pagos verificados en el período"
          icon={Wallet}
        />
        <Stat
          label="Tickets abiertos"
          value={resumen?.tickets_abiertos || 0}
          hint="Solicitudes de soporte sin resolver"
          icon={Headphones}
          tone={resumen?.tickets_abiertos ? 'warn' : 'default'}
        />
        <Stat
          label="Planes publicados"
          value={resumen?.planes_activos || 0}
          hint="Disponibles para nuevas empresas"
          icon={ShieldAlert}
        />
      </div>

      <div className="master-columns">
        <Card
          title="Ocupación operativa"
          subtitle="Recursos que las empresas tienen cargados y capacidad contratada."
        >
          <div className="master-occupancy">
            <div className="master-occupancy-row">
              <div>
                <span><Users size={14} /> Trabajadores</span>
                <strong>{trabajadores}</strong>
              </div>
              <Progress value={ocupacionTrabajadores ?? 0} tone={ocupacionTrabajadores > 85 ? 'warn' : 'ok'} />
              <small>
                {capacidadGuardias
                  ? `${ocupacionTrabajadores}% de ${capacidadGuardias} cupos contratados`
                  : 'Sin cupos definidos en los planes activos'}
              </small>
            </div>
            <div className="master-occupancy-row">
              <div>
                <span><Building2 size={14} /> Clientes</span>
                <strong>{resumen?.clientes || 0}</strong>
              </div>
              <small>Mandantes gestionados por todas las empresas.</small>
            </div>
            <div className="master-occupancy-row">
              <div>
                <span><UserRound size={14} /> Usuarios operadores</span>
                <strong>{resumen?.operadores || 0}</strong>
              </div>
              <small>Cuentas con acceso a la operación de su empresa.</small>
            </div>
            <div className="master-occupancy-row">
              <div>
                <span><CreditCard size={14} /> MRR de empresas activas</span>
                <strong>{money(resumen?.mrr || 0)}</strong>
              </div>
              <small>Suma de los planes de las empresas activas.</small>
            </div>
          </div>
        </Card>

        <Card
          title="Empresas por estado"
          subtitle="Distribución actual de todas las cuentas registradas."
        >
          {hasEmpresas ? (
            <div className="master-state-list">
              {STATE_ROWS.map((row) => {
                const value = Number(resumen?.[row.key] || 0);
                const pct = total ? Math.round((value / total) * 100) : 0;
                return (
                  <div className="master-state-row" key={row.key}>
                    <div className="master-state-head">
                      <span>{row.label}</span>
                      <strong>{value}</strong>
                    </div>
                    <div className={`master-state-bar is-${row.tone}`}>
                      <span style={{ width: `${pct}%` }} />
                    </div>
                    <small>{pct}% de las empresas registradas</small>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Building2}
              title="Aún no hay empresas"
              description="Cuando una empresa complete el registro público aparecerá aquí con su estado, plan y ocupación."
            />
          )}
        </Card>

        <Card
          title="Pruebas por vencer"
          subtitle="Empresas que necesitan activar su plan para no perder el acceso."
          actions={<Link className="btn btn-ghost btn-sm" to="/master/empresas">Ver empresas <ArrowRight size={15} /></Link>}
        >
          {pruebas.length ? (
            <ul className="master-list">
              {pruebas.map((empresa) => (
                <li key={empresa.id}>
                  <span className={`master-list-icon ${Number(empresa.dias_prueba) <= 5 ? 'is-warn' : 'is-info'}`}>
                    <CalendarClock size={17} />
                  </span>
                  <div className="master-list-body">
                    <strong>{empresa.razon_social}</strong>
                    <span>
                      {empresa.plan_nombre || 'Sin plan'}
                      {empresa.prueba_fin ? ` · termina ${dateLabel(empresa.prueba_fin)}` : ''}
                    </span>
                  </div>
                  <div className="master-list-side">
                    <Badge tone={Number(empresa.dias_prueba) <= 5 ? 'warn' : 'info'} dot>
                      {Number(empresa.dias_prueba) <= 0
                        ? 'Vence hoy'
                        : `${empresa.dias_prueba} día${Number(empresa.dias_prueba) === 1 ? '' : 's'}`}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={CalendarClock}
              title="Sin pruebas activas"
              description="No hay empresas en período de prueba en este momento."
            />
          )}
        </Card>

        <Card
          title="Empresas recientes"
          subtitle="Últimas cuentas que se registraron en la plataforma."
          actions={<Link className="btn btn-ghost btn-sm" to="/master/empresas">Ver todas <ArrowRight size={15} /></Link>}
        >
          {recientes.length ? (
            <ul className="master-list">
              {recientes.map((empresa) => (
                <li key={empresa.id}>
                  <span className={`master-list-icon ${empresa.estado === 'activa' ? 'is-info' : empresa.estado === 'prueba' ? 'is-warn' : 'is-danger'}`}>
                    <Building2 size={17} />
                  </span>
                  <div className="master-list-body">
                    <strong>{empresa.razon_social}</strong>
                    <span>
                      {empresa.plan_nombre || 'Sin plan'} · {plural(empresa.clientes, 'cliente', 'clientes')} ·{' '}
                      {plural(empresa.guardias, 'trabajador', 'trabajadores')}
                    </span>
                  </div>
                  <div className="master-list-side">
                    <Badge
                      tone={empresa.estado === 'activa' ? 'ok' : empresa.estado === 'prueba' ? 'info' : empresa.estado === 'suspendida' ? 'danger' : 'warn'}
                      dot
                    >
                      {empresa.estado === 'prueba' ? 'En prueba' : empresa.estado}
                    </Badge>
                    <small>{relativeTime(empresa.creado_en)}</small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Sparkles}
              title="Sin registros todavía"
              description="Comparte la página de registro para que las empresas comiencen a crear su cuenta."
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
          {ticketsRecientes.length ? (
            <ul className="master-list">
              {ticketsRecientes.map((ticket) => (
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
      </div>

      <Card
        title="Empresas que requieren atención"
        subtitle="Pruebas vencidas, cuentas suspendidas o pagos vencidos."
        actions={<Link className="btn btn-ghost btn-sm" to="/master/empresas">Gestionar <ArrowRight size={15} /></Link>}
      >
        {empresasAtencion.length ? (
          <ul className="master-list master-list-inline">
            {empresasAtencion.map((empresa) => (
              <li key={empresa.id}>
                <span className={`master-list-icon ${empresa.estado === 'suspendida' || empresa.estado === 'vencida' ? 'is-danger' : 'is-warn'}`}>
                  <ShieldAlert size={17} />
                </span>
                <div className="master-list-body">
                  <strong>{empresa.razon_social}</strong>
                  <span>
                    {empresa.plan_nombre || 'Sin plan'}
                    {empresa.ultimo_periodo
                      ? ` · ${periodLabel(empresa.ultimo_periodo)}: ${empresa.ultimo_pago_estado}`
                      : empresa.estado === 'prueba'
                        ? ` · prueba termina ${dateLabel(empresa.prueba_fin)}`
                        : ' · sin pagos registrados'}
                  </span>
                </div>
                <Badge tone={empresa.estado === 'suspendida' || empresa.estado === 'vencida' ? 'danger' : 'warn'} dot>
                  {empresa.estado === 'suspendida'
                    ? 'Suspendida'
                    : empresa.estado === 'vencida'
                      ? 'Prueba vencida'
                      : 'Prueba por vencer'}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={CheckCircle2}
            title="Todo al día"
            description="No hay empresas bloqueadas, pruebas vencidas ni pagos vencidos pendientes de revisión."
          />
        )}
      </Card>

      <div className="master-note-grid">
        <div className="master-note">
          <Sparkles size={18} />
          <div>
            <strong>Alta pública</strong>
            <span>Las empresas se registran desde la página pública con su administrador y plan. El supervisor no crea cuentas.</span>
          </div>
        </div>
        <div className="master-note">
          <TrendingUp size={18} />
          <div>
            <strong>Prueba de 15 días</strong>
            <span>La prueba comienza al registrarse. Al vencer, el acceso se bloquea automáticamente hasta que se verifique el pago.</span>
          </div>
        </div>
        <div className="master-note">
          <ShieldCheck size={18} />
          <div>
            <strong>Pago habilita el acceso</strong>
            <span>Al marcar un pago como pagado, la empresa pasa a activa y todos sus usuarios recuperan el acceso.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
