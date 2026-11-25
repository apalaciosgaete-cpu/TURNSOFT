import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CalendarClock,
  Clock3,
  CreditCard,
  ImagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { SECTOR_META } from '@shared/legal.js';
import { WEEKDAYS_SHORT } from '@shared/dates.js';
import { apiRequest, useAuth } from '../store/AuthContext.jsx';
import { useSafeturn } from '../store/SafeturnContext.jsx';
import { dateLabel, money, trialDaysLeft } from '../lib/format.js';
import { EMAIL_RE, RUT_RE, normalizeRut, timeInput } from '../lib/forms.js';
import { CompanyMark, useCompanyLogo } from '../components/CompanyMark.jsx';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  Stat,
  Toggle,
} from '../components/ui.jsx';

const SECTORES = Object.values(SECTOR_META);
const COLORS = ['#0f766e', '#0284c7', '#7c3aed', '#db2777', '#b45309', '#059669', '#dc2626', '#475569'];

const EMPTY_EMPRESA = {
  razon_social: '',
  rut_empresa: '',
  sector: 'seguridad',
  email_contacto: '',
  telefono: '',
  direccion: '',
  ciudad: '',
  notas: '',
};

const EMPTY_PLANTILLA = {
  nombre: '',
  codigo: '',
  hora_inicio: '08:00',
  hora_fin: '20:00',
  duracion_horas: 12,
  minutos_colacion: 60,
  es_nocturno: false,
  color: COLORS[0],
  cobertura_semanal: [1, 1, 1, 1, 1, 0, 0],
  certificaciones: '',
};

function durationFromTimes(start, end) {
  const [startHour, startMinute] = String(start || '').split(':').map(Number);
  const [endHour, endMinute] = String(end || '').split(':').map(Number);
  if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return 0;
  let minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  if (minutes <= 0) minutes += 24 * 60;
  return Math.round((minutes / 60) * 10) / 10;
}

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
  return estado || 'Sin estado';
}

function toEmpresaForm(empresa) {
  return {
    razon_social: empresa.razon_social || '',
    rut_empresa: empresa.rut_empresa || '',
    sector: empresa.sector || 'seguridad',
    email_contacto: empresa.email_contacto || '',
    telefono: empresa.telefono || '',
    direccion: empresa.direccion || '',
    ciudad: empresa.ciudad || '',
    notas: empresa.notas || '',
  };
}

function toPlantillaForm(plantilla) {
  return {
    nombre: plantilla.nombre || '',
    codigo: plantilla.codigo || '',
    hora_inicio: timeInput(plantilla.hora_inicio) || '08:00',
    hora_fin: timeInput(plantilla.hora_fin) || '20:00',
    duracion_horas: Number(plantilla.duracion_horas) || 12,
    minutos_colacion: Number(plantilla.minutos_colacion) || 0,
    es_nocturno: Boolean(plantilla.es_nocturno),
    color: plantilla.color || COLORS[0],
    cobertura_semanal: Array.isArray(plantilla.cobertura_semanal)
      ? plantilla.cobertura_semanal.slice(0, 7).map((value) => Number(value) || 0)
      : [1, 1, 1, 1, 1, 0, 0],
    certificaciones: Array.isArray(plantilla.certificaciones_requeridas)
      ? plantilla.certificaciones_requeridas.join(', ')
      : '',
  };
}

export default function MiEmpresa() {
  const { token, readOnly, session } = useAuth();
  const companyLogo = useCompanyLogo();
  const { notify } = useSafeturn();

  const [empresa, setEmpresa] = useState(null);
  const [form, setForm] = useState(EMPTY_EMPRESA);
  const [plantillas, setPlantillas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [plantillaEditor, setPlantillaEditor] = useState(null);
  const [plantillaForm, setPlantillaForm] = useState(EMPTY_PLANTILLA);
  const [plantillaError, setPlantillaError] = useState('');
  const [savingPlantilla, setSavingPlantilla] = useState(false);

  const cargar = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError('');
    try {
      const [empresas, listaPlantillas] = await Promise.all([
        apiRequest('/empresas', { token }),
        apiRequest('/turno-plantillas', { token }),
      ]);
      const actual = Array.isArray(empresas) ? empresas[0] : empresas;
      if (!actual) {
        throw new Error('No encontramos la empresa asociada a tu cuenta.');
      }
      setEmpresa(actual);
      setForm(toEmpresaForm(actual));
      setPlantillas(Array.isArray(listaPlantillas) ? listaPlantillas : []);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const diasPrueba = trialDaysLeft(empresa?.prueba_fin);

  const set = (key, value) => {
    setFormError('');
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const guardarEmpresa = async (event) => {
    event.preventDefault();
    if (!empresa) return;
    setFormError('');

    const rut = normalizeRut(form.rut_empresa);
    if (form.razon_social.trim().length < 2) {
      setFormError('Ingresa la razón social de la empresa.');
    } else if (!RUT_RE.test(rut)) {
      setFormError('Ingresa un RUT válido, por ejemplo 76.123.456-7.');
    } else if (form.email_contacto && !EMAIL_RE.test(form.email_contacto.trim())) {
      setFormError('Ingresa un correo de contacto válido.');
    } else {
      setSaving(true);
      try {
        const actualizada = await apiRequest(`/empresas/${empresa.id}`, {
          method: 'PATCH',
          token,
          body: {
            razon_social: form.razon_social.trim(),
            rut_empresa: rut,
            sector: form.sector,
            email_contacto: form.email_contacto.trim(),
            telefono: form.telefono.trim(),
            direccion: form.direccion.trim(),
            ciudad: form.ciudad.trim(),
            notas: form.notas.trim(),
          },
        });
        setEmpresa((previous) => ({ ...previous, ...actualizada }));
        setForm(toEmpresaForm({ ...empresa, ...actualizada }));
        notify('Datos de la empresa guardados.');
      } catch (error) {
        setFormError(error.message);
      } finally {
        setSaving(false);
      }
    }
  };

  const abrirPlantillaNueva = () => {
    setPlantillaForm({ ...EMPTY_PLANTILLA });
    setPlantillaEditor('new');
    setPlantillaError('');
  };

  const abrirPlantillaEditar = (plantilla) => {
    setPlantillaForm(toPlantillaForm(plantilla));
    setPlantillaEditor(plantilla);
    setPlantillaError('');
  };

  const setPlantilla = (key, value) => {
    setPlantillaError('');
    setPlantillaForm((previous) => ({ ...previous, [key]: value }));
  };

  const setHora = (key, value) => {
    setPlantillaError('');
    setPlantillaForm((previous) => {
      const next = { ...previous, [key]: value };
      const duracion = durationFromTimes(next.hora_inicio, next.hora_fin);
      if (duracion > 0 && duracion <= 24) next.duracion_horas = duracion;
      return next;
    });
  };

  const setCobertura = (index, value) => {
    const safe = Math.max(0, Math.min(20, Number(value) || 0));
    setPlantillaForm((previous) => ({
      ...previous,
      cobertura_semanal: previous.cobertura_semanal.map((item, itemIndex) =>
        itemIndex === index ? safe : item
      ),
    }));
  };

  const guardarPlantilla = async (event) => {
    event.preventDefault();
    setPlantillaError('');
    const duracion = Number(plantillaForm.duracion_horas);

    if (!plantillaForm.nombre.trim()) {
      return setPlantillaError('Ingresa un nombre para el horario.');
    }
    if (!plantillaForm.hora_inicio || !plantillaForm.hora_fin) {
      return setPlantillaError('Define la hora de entrada y de salida.');
    }
    if (!Number.isFinite(duracion) || duracion <= 0 || duracion > 24) {
      return setPlantillaError('La duración debe estar entre 1 y 24 horas.');
    }

    const payload = {
      nombre: plantillaForm.nombre.trim(),
      codigo: plantillaForm.codigo.trim() || null,
      hora_inicio: plantillaForm.hora_inicio,
      hora_fin: plantillaForm.hora_fin,
      duracion_horas: duracion,
      minutos_colacion: Number(plantillaForm.minutos_colacion) || 0,
      es_nocturno: Boolean(plantillaForm.es_nocturno),
      color: plantillaForm.color,
      cobertura_semanal: plantillaForm.cobertura_semanal,
      certificaciones_requeridas: plantillaForm.certificaciones
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    };

    setSavingPlantilla(true);
    try {
      if (plantillaEditor === 'new') {
        await apiRequest('/turno-plantillas', { method: 'POST', token, body: payload });
        notify('Horario base agregado a la empresa.');
      } else {
        await apiRequest(`/turno-plantillas/${plantillaEditor.id}`, {
          method: 'PUT',
          token,
          body: payload,
        });
        notify('Horario base actualizado.');
      }
      setPlantillaEditor(null);
      await cargar();
    } catch (error) {
      setPlantillaError(error.message);
    } finally {
      setSavingPlantilla(false);
    }
  };

  const eliminarPlantilla = async (plantilla) => {
    if (!window.confirm(`¿Eliminar el horario "${plantilla.nombre}"?`)) return;
    try {
      await apiRequest(`/turno-plantillas/${plantilla.id}`, { method: 'DELETE', token });
      notify('Horario base eliminado.', 'info');
      await cargar();
    } catch (error) {
      notify(error.message, 'error');
    }
  };

  if (loading && !empresa) {
    return (
      <div className="page company-page">
        <div className="master-loading">
          <span className="master-loading-ring" />
          <div>
            <strong>Cargando tu empresa…</strong>
            <p>Datos, base de trabajadores y horarios de entrada/salida.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loadError && !empresa) {
    return (
      <div className="page company-page">
        <div className="master-error">
          <AlertTriangle size={26} />
          <div>
            <strong>No se pudo cargar tu empresa</strong>
            <p>{loadError}</p>
          </div>
          <Button variant="secondary" icon={RefreshCw} onClick={cargar}>
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  if (!empresa) return null;

  const sector = SECTOR_META[empresa.sector] || SECTOR_META.seguridad;
  const puedeEditarEmpresa =
    !readOnly && empresa.estado !== 'suspendida' && empresa.estado !== 'vencida';

  return (
    <div className="page company-page">
      <div className="stat-grid stat-grid-compact">
        <Stat
          label="Plan contratado"
          value={empresa.plan_nombre || 'Sin plan'}
          hint={empresa.precio_mensual ? `${money(empresa.precio_mensual)} al mes` : 'El supervisor puede asignarte un plan'}
          icon={CreditCard}
        />
        <Stat
          label="Estado de la empresa"
          value={estadoLabel(empresa.estado)}
          hint={
            empresa.estado === 'prueba'
              ? `${diasPrueba ?? 0} días restantes · termina ${dateLabel(empresa.prueba_fin)}`
              : empresa.estado === 'activa'
                ? 'Acceso habilitado para toda la empresa'
                : 'Contacta a SAFETURN para regularizar'
          }
          icon={ShieldCheck}
          tone={estadoTone(empresa.estado)}
        />
        <Stat
          label="Horarios base"
          value={plantillas.length}
          hint="Entrada, salida y colación por turno"
          icon={Clock3}
        />
      </div>

      {empresa.estado === 'prueba' ? (
        <div className="company-trial-strip">
          <span className="company-trial-icon"><Sparkles size={19} /></span>
          <div>
            <strong>Prueba de 15 días en curso</strong>
            <p>
              Quedan <strong>{diasPrueba ?? 0} días</strong> y tu prueba termina el{' '}
              {dateLabel(empresa.prueba_fin)}. Cuando SAFETURN verifique tu pago, la empresa
              pasa a activa automáticamente.
            </p>
          </div>
          <Badge tone={diasPrueba !== null && diasPrueba <= 5 ? 'warn' : 'info'} dot>
            {diasPrueba !== null && diasPrueba <= 5 ? 'Por vencer' : 'En prueba'}
          </Badge>
        </div>
      ) : null}

      <Card
        title="Identidad de la empresa"
        subtitle="Tu logo aparece en el menú lateral para todo tu equipo."
      >
        <div className="company-identity">
          <CompanyMark name={empresa.razon_social} logo={session?.empresaLogo} size={84} />
          <div className="company-identity-copy">
            <strong>{empresa.razon_social}</strong>
            <span>
              {companyLogo.hasLogo
                ? 'Logo cargado. Puedes cambiarlo o quitarlo cuando quieras.'
                : 'Aún no subes un logo. Mientras tanto se muestran las iniciales de tu empresa.'}
            </span>
            {companyLogo.canEdit ? (
              <div className="company-identity-actions">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={ImagePlus}
                  onClick={companyLogo.pick}
                  disabled={companyLogo.busy}
                >
                  {companyLogo.busy ? 'Subiendo…' : companyLogo.hasLogo ? 'Cambiar logo' : 'Subir logo'}
                </Button>
                {companyLogo.hasLogo ? (
                  <Button size="sm" variant="ghost" icon={Trash2} onClick={companyLogo.remove} disabled={companyLogo.busy}>
                    Quitar
                  </Button>
                ) : null}
              </div>
            ) : null}
            <small>PNG, JPG o WebP. Se ajusta solo a un tamaño liviano; un logo cuadrado o con fondo transparente se ve mejor.</small>
          </div>
          {companyLogo.input}
        </div>
      </Card>

      <Card
        title="Datos de la empresa"
        subtitle="Esta información identifica a tu empresa dentro de SAFETURN y se usa en la operación."
        actions={
          <Badge tone={estadoTone(empresa.estado)} dot>
            {estadoLabel(empresa.estado)}
          </Badge>
        }
      >
        <form className="form-grid company-form" onSubmit={guardarEmpresa}>
          <fieldset className="readonly-fieldset is-contents" disabled={readOnly}>
          <Field label="Razón social" className="field-full">
            <input
              className="input"
              value={form.razon_social}
              onChange={(event) => set('razon_social', event.target.value)}
              placeholder="Ej. Seguridad Austral SpA"
            />
          </Field>
          <Field label="RUT de la empresa">
            <input
              className="input"
              value={form.rut_empresa}
              onChange={(event) => set('rut_empresa', event.target.value)}
              placeholder="76.123.456-7"
            />
          </Field>
          <Field label="Sector">
            <select
              className="input"
              value={form.sector}
              onChange={(event) => set('sector', event.target.value)}
            >
              {SECTORES.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Correo de contacto">
            <input
              className="input"
              type="email"
              value={form.email_contacto}
              onChange={(event) => set('email_contacto', event.target.value)}
              placeholder="contacto@empresa.cl"
            />
          </Field>
          <Field label="Teléfono">
            <input
              className="input"
              value={form.telefono}
              onChange={(event) => set('telefono', event.target.value)}
              placeholder="+56 9 1234 5678"
            />
          </Field>
          <Field label="Dirección" className="field-full">
            <input
              className="input"
              value={form.direccion}
              onChange={(event) => set('direccion', event.target.value)}
              placeholder="Av. Providencia 1234, oficina 56"
            />
          </Field>
          <Field label="Ciudad">
            <input
              className="input"
              value={form.ciudad}
              onChange={(event) => set('ciudad', event.target.value)}
              placeholder="Santiago"
            />
          </Field>
          <Field label="Notas de la empresa">
            <input
              className="input"
              value={form.notas}
              onChange={(event) => set('notas', event.target.value)}
              placeholder="Referencias internas de la cuenta"
            />
          </Field>

          {formError ? <div className="form-error field-full">{formError}</div> : null}

          <div className="company-form-foot field-full">
            <span className="company-form-hint">
              <Building2 size={14} /> {sector.description}
            </span>
            <Button type="submit" icon={Save} disabled={saving || !puedeEditarEmpresa}>
              {saving ? 'Guardando…' : 'Guardar datos'}
            </Button>
          </div>
          </fieldset>
        </form>
      </Card>

      <Card
        title="Horarios de entrada y salida"
        subtitle="Define los turnos base de tu empresa. Luego los traes a cada planificación desde Turnos."
        actions={
          <div className="card-actions-row">
            <Badge tone="neutral">{plantillas.length} horarios</Badge>
            <Button size="sm" icon={Plus} onClick={abrirPlantillaNueva} hidden={readOnly}>Nuevo horario</Button>
          </div>
        }
      >
        {plantillas.length ? (
          <div className="company-shift-grid">
            {plantillas.map((plantilla) => (
              <article className="company-shift-card" key={plantilla.id} style={{ '--shift-color': plantilla.color || COLORS[0] }}>
                <header>
                  <span className="company-shift-code" style={{ background: `${plantilla.color || COLORS[0]}16`, color: plantilla.color || COLORS[0] }}>
                    {plantilla.codigo || 'T'}
                  </span>
                  <div>
                    <strong>{plantilla.nombre}</strong>
                    <span>
                      {timeInput(plantilla.hora_inicio)}–{timeInput(plantilla.hora_fin)}
                      {plantilla.es_nocturno ? ' · nocturno' : ''}
                    </span>
                  </div>
                  <div className="company-shift-actions" hidden={readOnly}>
                    <button type="button" className="icon-btn" title="Editar horario" onClick={() => abrirPlantillaEditar(plantilla)}>
                      <Pencil size={16} />
                    </button>
                    <button type="button" className="icon-btn danger" title="Eliminar horario" onClick={() => eliminarPlantilla(plantilla)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </header>

                <div className="company-shift-metrics">
                  <div><span>Duración</span><strong>{plantilla.duracion_horas} h</strong></div>
                  <div><span>Colación</span><strong>{plantilla.minutos_colacion || 0} min</strong></div>
                </div>

                <div className="company-shift-coverage">
                  {WEEKDAYS_SHORT.map((label, index) => (
                    <span key={label} className={Number(plantilla.cobertura_semanal?.[index] || 0) === 0 ? 'is-off' : ''}>
                      <small>{label}</small>
                      <strong>{Number(plantilla.cobertura_semanal?.[index] || 0)}</strong>
                    </span>
                  ))}
                </div>

                {Array.isArray(plantilla.certificaciones_requeridas) && plantilla.certificaciones_requeridas.length ? (
                  <div className="chip-row">
                    {plantilla.certificaciones_requeridas.map((name) => (
                      <span key={name} className="cert-chip"><BadgeCheck size={13} /> {name}</span>
                    ))}
                  </div>
                ) : (
                  <span className="muted">Sin certificaciones exigidas</span>
                )}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Clock3}
            title="Aún no hay horarios base"
            description="Crea tus turnos de entrada y salida para reutilizarlos en todas las planificaciones de la empresa."
            action={readOnly ? null : <Button icon={Plus} onClick={abrirPlantillaNueva}>Crear primer horario</Button>}
          />
        )}
      </Card>

      <div className="company-note-grid">
        <div className="company-note">
          <Users size={18} />
          <div>
            <strong>Una base, muchas planificaciones</strong>
            <span>Los horarios base se cargan una vez por empresa. Cada planificación decide si los usa.</span>
          </div>
        </div>
        <div className="company-note">
          <CalendarClock size={18} />
          <div>
            <strong>Prueba y pago</strong>
            <span>La prueba dura 15 días. Al verificar el pago, la empresa pasa a activa y recupera el acceso completo.</span>
          </div>
        </div>
        <div className="company-note">
          <ShieldCheck size={18} />
          <div>
            <strong>Datos aislados</strong>
            <span>Los datos de tu empresa y tus horarios solo son visibles para tus usuarios.</span>
          </div>
        </div>
      </div>

      <Modal
        open={Boolean(plantillaEditor)}
        onClose={() => setPlantillaEditor(null)}
        title={plantillaEditor === 'new' ? 'Nuevo horario base' : `Editar ${plantillaEditor?.nombre || ''}`}
        subtitle="Define entrada, salida, colación y cobertura. La duración se calcula automáticamente y puedes ajustarla."
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setPlantillaEditor(null)}>Cancelar</Button>
            <Button icon={Save} onClick={guardarPlantilla} disabled={savingPlantilla}>
              {savingPlantilla ? 'Guardando…' : plantillaEditor === 'new' ? 'Crear horario' : 'Guardar cambios'}
            </Button>
          </>
        }
      >
        <form className="form-grid" onSubmit={guardarPlantilla}>
          <Field label="Nombre del horario">
            <input
              className="input"
              value={plantillaForm.nombre}
              onChange={(event) => setPlantilla('nombre', event.target.value)}
              placeholder="Turno día 12 h"
            />
          </Field>
          <Field label="Código" hint="Se muestra en la grilla. Máximo 6 caracteres.">
            <input
              className="input"
              value={plantillaForm.codigo}
              onChange={(event) => setPlantilla('codigo', event.target.value)}
              placeholder="D12"
              maxLength={6}
            />
          </Field>
          <Field label="Hora de entrada">
            <input
              className="input"
              type="time"
              value={plantillaForm.hora_inicio}
              onChange={(event) => setHora('hora_inicio', event.target.value)}
            />
          </Field>
          <Field label="Hora de salida">
            <input
              className="input"
              type="time"
              value={plantillaForm.hora_fin}
              onChange={(event) => setHora('hora_fin', event.target.value)}
            />
          </Field>
          <Field label="Duración (h)">
            <input
              className="input"
              type="number"
              min="1"
              max="24"
              step="0.5"
              value={plantillaForm.duracion_horas}
              onChange={(event) => setPlantilla('duracion_horas', event.target.value)}
            />
          </Field>
          <Field label="Colación (minutos)">
            <input
              className="input"
              type="number"
              min="0"
              max="240"
              value={plantillaForm.minutos_colacion}
              onChange={(event) => setPlantilla('minutos_colacion', event.target.value)}
            />
          </Field>

          <Field label="Color">
            <div className="color-row">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-dot ${plantillaForm.color === color ? 'is-active' : ''}`}
                  style={{ background: color }}
                  onClick={() => setPlantilla('color', color)}
                  aria-label={`Color ${color}`}
                />
              ))}
              <input
                type="color"
                className="color-input"
                value={plantillaForm.color}
                onChange={(event) => setPlantilla('color', event.target.value)}
              />
            </div>
          </Field>

          <Field label="Certificaciones exigidas" hint="Sepáralas con coma. Ej: OS-10, Seguridad minera.">
            <input
              className="input"
              value={plantillaForm.certificaciones}
              onChange={(event) => setPlantilla('certificaciones', event.target.value)}
              placeholder="OS-10"
            />
          </Field>

          <div className="field field-full">
            <span className="field-label">Cobertura requerida por día</span>
            <div className="coverage-editor">
              {WEEKDAYS_SHORT.map((label, index) => (
                <label key={label} className="coverage-input">
                  <span>{label}</span>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={plantillaForm.cobertura_semanal[index]}
                    onChange={(event) => setCobertura(index, event.target.value)}
                  />
                </label>
              ))}
            </div>
            <span className="field-hint">Usa 0 para cerrar la operación ese día.</span>
          </div>

          <div className="field-full">
            <Toggle
              checked={plantillaForm.es_nocturno}
              onChange={(checked) => setPlantilla('es_nocturno', checked)}
              label="Turno nocturno"
              description="Actívalo si el horario cruza la noche para aplicar los topes de noches consecutivas."
            />
          </div>

          {plantillaError ? <div className="form-error field-full">{plantillaError}</div> : null}
        </form>
      </Modal>
    </div>
  );
}
