import { useState } from 'react';
import {
  Building2,
  Check,
  Pencil,
  Plus,
  ShieldCheck,
  Users,
  UserRound,
} from 'lucide-react';
import { useMaster } from '../store/MasterContext.jsx';
import { money } from '../lib/format.js';
import { Badge, Button, Card, EmptyState, Toggle } from '../components/ui.jsx';
import { MasterPlanModal } from '../components/MasterPlanModal.jsx';

function limitLabel(value, singular, plural) {
  if (value === null || value === undefined) return 'Ilimitado';
  if (Number(value) === 1) return `1 ${singular}`;
  return `${value} ${plural}`;
}

export default function MasterPlans() {
  const { planes, loading, error, updatePlan, refresh } = useMaster();
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const openCreate = () => {
    setSelected(null);
    setModalOpen(true);
  };

  const openEdit = (plan) => {
    setSelected(plan);
    setModalOpen(true);
  };

  const toggleActive = async (plan, checked) => {
    setBusyId(plan.id);
    try {
      await updatePlan(plan.id, { activo: checked });
    } catch {
      // El contexto muestra el error de la petición.
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="page master-page">
      <div className="master-toolbar">
        <div className="master-toolbar-filters">
          <span className="master-toolbar-label">
            <ShieldCheck size={16} /> {planes.length}{' '}
            {planes.length === 1 ? 'plan configurado' : 'planes configurados'}
          </span>
        </div>
        <Button icon={Plus} onClick={openCreate}>Nuevo plan</Button>
      </div>

      {error ? (
        <div className="master-inline-error">
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={() => refresh()}>Reintentar</Button>
        </div>
      ) : null}

      {loading && !planes.length ? (
        <div className="master-loading">
          <span className="master-loading-ring" />
          <div><strong>Cargando planes…</strong></div>
        </div>
      ) : planes.length ? (
        <div className="master-plan-grid">
          {planes.map((plan) => (
            <Card
              key={plan.id}
              className={`master-plan-card ${plan.activo ? '' : 'is-inactive'}`}
              title={plan.nombre}
              subtitle={plan.descripcion || 'Sin descripción.'}
              actions={
                <Badge tone={plan.activo ? 'ok' : 'neutral'} dot>
                  {plan.activo ? 'Disponible' : 'Inactivo'}
                </Badge>
              }
            >
              <div className="master-plan-price">
                <strong>{money(plan.precio_mensual)}</strong>
                <span>por mes</span>
              </div>

              <ul className="master-plan-limits">
                <li>
                  <Building2 size={16} />
                  <span>{limitLabel(plan.max_clientes, 'cliente', 'clientes')}</span>
                </li>
                <li>
                  <UserRound size={16} />
                  <span>{limitLabel(plan.max_usuarios, 'usuario operador', 'usuarios operadores')}</span>
                </li>
                <li>
                  <Users size={16} />
                  <span>{limitLabel(plan.max_guardias, 'guardia', 'guardias')}</span>
                </li>
              </ul>

              <div className="master-plan-meta">
                <span>
                  <Check size={14} />
                  {plan.empresas} empresa{plan.empresas === 1 ? '' : 's'} en este plan
                </span>
              </div>

              <div className="master-plan-actions">
                <Button variant="secondary" size="sm" icon={Pencil} onClick={() => openEdit(plan)}>
                  Editar plan
                </Button>
              </div>

              <div className="master-plan-toggle">
                <Toggle
                  checked={plan.activo}
                  onChange={(checked) => toggleActive(plan, checked)}
                  disabled={busyId === plan.id}
                  label="Disponible para nuevas empresas"
                />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title="Aún no hay planes"
            description="Crea tu primer plan con precio mensual y límites de clientes, usuarios y guardias."
            action={<Button icon={Plus} onClick={openCreate}>Publicar primer plan</Button>}
          />
        </Card>
      )}

      <div className="master-note-grid">
        <div className="master-note">
          <ShieldCheck size={18} />
          <div>
            <strong>Validación en backend</strong>
            <span>Los límites se aplican al crear clientes y guardias. El plan se puede ampliar en cualquier momento.</span>
          </div>
        </div>
        <div className="master-note">
          <Building2 size={18} />
          <div>
            <strong>Cambio de plan por empresa</strong>
            <span>Asigna un plan distinto desde Empresas → Gestionar, sin afectar sus datos.</span>
          </div>
        </div>
        <div className="master-note">
          <Users size={18} />
          <div>
            <strong>Cupos ilimitados</strong>
            <span>Deja un límite vacío para que el plan no restrinja ese recurso.</span>
          </div>
        </div>
      </div>

      <MasterPlanModal
        open={modalOpen}
        plan={selected}
        onClose={() => {
          setModalOpen(false);
          setSelected(null);
        }}
      />
    </div>
  );
}
