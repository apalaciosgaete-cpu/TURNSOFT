import { useEffect, useState } from 'react';
import { Ban, CheckCircle2, Save, ShieldAlert, Sparkles } from 'lucide-react';
import { SECTOR_META } from '@shared/legal.js';
import { useMaster } from '../store/MasterContext.jsx';
import { dateLabel, money, trialDaysLeft, usage } from '../lib/format.js';
import { Badge, Button, Field, Modal, Progress } from './ui.jsx';

const ESTADOS = [
  { id: 'prueba', label: 'En prueba (15 días)' },
  { id: 'activa', label: 'Activa' },
  { id: 'suspendida', label: 'Suspendida' },
  { id: 'vencida', label: 'Prueba vencida' },
];

function estadoTone(estado) {
  if (estado === 'activa') return 'ok';
  if (estado === 'prueba') return 'info';
  if (estado === 'vencida') return 'warn';
  return 'danger';
}

function estadoLabel(estado) {
  if (estado === 'activa') return 'Activa';
  if (estado === 'prueba') return 'En prueba';
  if (estado === 'vencida') return 'Prueba vencida';
  if (estado === 'suspendida') return 'Suspendida';
  return estado;
}

export function MasterCompanySettings({ open, empresa, onClose }) {
  const { planes, updateEmpresa } = useMaster();
  const [form, setForm] = useState({
    plan_id: '',
    dia_cobro: 1,
    notas: '',
    motivo_bloqueo: '',
    estado: 'activa',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [blocking, setBlocking] = useState(false);

  useEffect(() => {
    if (!open || !empresa) return;
    setForm({
      plan_id: empresa.plan_id || '',
      dia_cobro: empresa.dia_cobro || 1,
      notas: empresa.notas || '',
      motivo_bloqueo: empresa.motivo_bloqueo || 'Falta de pago',
      estado: empresa.estado || 'activa',
    });
    setError('');
    setBlocking(false);
  }, [open, empresa]);

  if (!empresa) return null;

  const suspendida = form.estado === 'suspendida';
  const vencida = form.estado === 'vencida';
  const enPrueba = form.estado === 'prueba';
  const selectedPlan = planes.find((plan) => plan.id === form.plan_id) || null;
  const sector = SECTOR_META[empresa.sector]?.label || empresa.sector;
  const diasPrueba = enPrueba ? trialDaysLeft(empresa.prueba_fin) ?? 0 : null;

  const save = async (event) => {
    event?.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        plan_id: form.plan_id || null,
        dia_cobro: Number(form.dia_cobro) || 1,
        notas: form.notas.trim(),
      };
      if (form.estado !== empresa.estado) {
        payload.estado = form.estado;
        if (form.estado === 'suspendida') {
          payload.motivo_bloqueo = form.motivo_bloqueo.trim() || 'Falta de pago';
        }
      }
      await updateEmpresa(empresa.id, payload);
      onClose?.();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const block = async () => {
    setSaving(true);
    setError('');
    try {
      await updateEmpresa(empresa.id, {
        estado: 'suspendida',
        motivo_bloqueo: form.motivo_bloqueo.trim() || 'Falta de pago',
      });
      onClose?.();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const reactivar = async () => {
    setSaving(true);
    setError('');
    try {
      await updateEmpresa(empresa.id, { estado: 'activa' });
      onClose?.();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const bannerTitle = suspendida
    ? 'Empresa suspendida'
    : vencida
      ? 'Prueba vencida'
      : enPrueba
        ? 'Empresa en período de prueba'
        : 'Empresa activa';

  const bannerCopy = suspendida
    ? `${empresa.motivo_bloqueo || 'Falta de pago'} · sus usuarios no pueden iniciar sesión.`
    : vencida
      ? 'La prueba de 15 días terminó. Sus usuarios no pueden operar hasta que se verifique un pago.'
      : enPrueba
        ? `Quedan ${diasPrueba ?? 0} días de prueba. Termina el ${dateLabel(empresa.prueba_fin)}.`
        : 'La empresa y sus usuarios pueden operar con normalidad.';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={empresa.razon_social}
      subtitle={`${empresa.rut_empresa} · ${sector}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
          <Button icon={Save} onClick={save} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={save}>
        <div className={`master-account-banner ${suspendida || vencida ? 'is-blocked' : ''} field-full`}>
          <span className="master-account-icon">
            {suspendida || vencida ? <ShieldAlert size={19} /> : enPrueba ? <Sparkles size={19} /> : <CheckCircle2 size={19} />}
          </span>
          <div>
            <strong>{bannerTitle}</strong>
            <span>{bannerCopy}</span>
          </div>
          <Badge tone={estadoTone(form.estado)} dot>
            {estadoLabel(form.estado)}
          </Badge>
        </div>

        {enPrueba || vencida ? (
          <div className="master-trial-summary field-full">
            <div>
              <span>Inicio de prueba</span>
              <strong>{dateLabel(empresa.prueba_inicio)}</strong>
            </div>
            <div>
              <span>Término de prueba</span>
              <strong>{dateLabel(empresa.prueba_fin)}</strong>
            </div>
            <div>
              <span>Origen</span>
              <strong>{empresa.origen === 'registro' ? 'Registro público' : 'Supervisor'}</strong>
            </div>
            <div>
              <span>Activada</span>
              <strong>{empresa.activada_en ? dateLabel(empresa.activada_en) : '—'}</strong>
            </div>
          </div>
        ) : null}

        <div className="master-usage-grid field-full">
          <div>
            <span>Clientes</span>
            <strong>{empresa.clientes}{selectedPlan?.max_clientes != null ? ` / ${selectedPlan.max_clientes}` : ''}</strong>
            <Progress
              value={usage(empresa.clientes, selectedPlan?.max_clientes) ?? 0}
              tone="ok"
            />
          </div>
          <div>
            <span>Usuarios operadores</span>
            <strong>{empresa.operadores}{selectedPlan?.max_usuarios != null ? ` / ${selectedPlan.max_usuarios}` : ''}</strong>
            <Progress
              value={usage(empresa.operadores, selectedPlan?.max_usuarios) ?? 0}
              tone="info"
            />
          </div>
          <div>
            <span>Guardias</span>
            <strong>{empresa.guardias}{selectedPlan?.max_guardias != null ? ` / ${selectedPlan.max_guardias}` : ''}</strong>
            <Progress
              value={usage(empresa.guardias, selectedPlan?.max_guardias) ?? 0}
              tone="warn"
            />
          </div>
        </div>

        <Field label="Plan contratado" hint={selectedPlan ? `${money(selectedPlan.precio_mensual)} al mes` : 'Sin cobro asociado.'}>
          <select
            className="input"
            value={form.plan_id}
            onChange={(event) => setForm((previous) => ({ ...previous, plan_id: event.target.value }))}
          >
            <option value="">Sin plan asignado</option>
            {planes.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.nombre} · {money(plan.precio_mensual)} {plan.activo ? '' : '(inactivo)'}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Estado de la cuenta" hint="El estado se aplica al guardar los cambios.">
          <select
            className="input"
            value={form.estado}
            onChange={(event) => setForm((previous) => ({ ...previous, estado: event.target.value }))}
          >
            {ESTADOS.map((estado) => (
              <option key={estado.id} value={estado.id}>{estado.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Día de cobro">
          <input
            className="input"
            type="number"
            min={1}
            max={28}
            value={form.dia_cobro}
            onChange={(event) => setForm((previous) => ({ ...previous, dia_cobro: event.target.value }))}
          />
        </Field>

        <Field label="Notas internas" className="field-full" hint="Solo visibles para el supervisor maestro.">
          <textarea
            className="input"
            rows={3}
            value={form.notas}
            onChange={(event) => setForm((previous) => ({ ...previous, notas: event.target.value }))}
            placeholder="Condiciones comerciales, contactos o acuerdos de pago."
          />
        </Field>

        <div className="field-full master-danger-zone">
          <div className="master-danger-copy">
            <strong>
              {suspendida || vencida ? 'Devolver el acceso' : 'Bloquear por no pago'}
            </strong>
            <span>
              {suspendida || vencida
                ? 'Restaura el acceso de todos los usuarios de la empresa de inmediato.'
                : 'El login y la API rechazarán el acceso de todos sus usuarios.'}
            </span>
          </div>
          {suspendida || vencida ? (
            <Button variant="secondary" icon={CheckCircle2} onClick={reactivar} disabled={saving}>
              Activar empresa
            </Button>
          ) : blocking ? (
            <div className="master-block-form">
              <input
                className="input"
                value={form.motivo_bloqueo}
                onChange={(event) => setForm((previous) => ({ ...previous, motivo_bloqueo: event.target.value }))}
                placeholder="Motivo del bloqueo"
              />
              <Button variant="danger" icon={Ban} onClick={block} disabled={saving}>
                Confirmar bloqueo
              </Button>
              <Button variant="ghost" onClick={() => setBlocking(false)}>Cancelar</Button>
            </div>
          ) : (
            <Button variant="danger" icon={Ban} onClick={() => setBlocking(true)}>
              Bloquear empresa
            </Button>
          )}
        </div>

        {error ? <div className="form-error field-full">{error}</div> : null}
      </form>
    </Modal>
  );
}
