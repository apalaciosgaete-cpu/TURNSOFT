import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CalendarRange,
  FileSpreadsheet,
  Mail,
  Pencil,
  Phone,
  Plug,
  Plus,
  Power,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { todayISO } from '@shared/dates.js';
import { apiRequest, useAuth } from '../store/AuthContext.jsx';
import { useSafeturn } from '../store/SafeturnContext.jsx';
import { dateLabel } from '../lib/format.js';
import { EMAIL_RE, RUT_RE, dateInput, normalizeRut } from '../lib/forms.js';
import { ConexionesModal } from '../components/ConexionesModal.jsx';
import { ImportarTrabajadores } from '../components/ImportarTrabajadores.jsx';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  Stat,
  Toggle,
} from '../components/ui.jsx';

const EMPTY_GUARDIA = {
  nombre_completo: '',
  rut: '',
  cargo: '',
  email: '',
  telefono: '',
  fecha_contrato: todayISO(),
  horas_semanales_max: 42,
  activo: true,
};

function toGuardiaForm(guardia) {
  return {
    nombre_completo: guardia.nombre_completo || '',
    rut: guardia.rut || '',
    cargo: guardia.cargo || '',
    email: guardia.email || '',
    telefono: guardia.telefono || '',
    fecha_contrato: dateInput(guardia.fecha_contrato) || todayISO(),
    horas_semanales_max: Number(guardia.horas_semanales_max) || 42,
    activo: guardia.activo !== false,
  };
}

export default function Trabajadores() {
  const { token, readOnly } = useAuth();
  const { notify } = useSafeturn();

  const [guardias, setGuardias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [guardiaEditor, setGuardiaEditor] = useState(null);
  const [guardiaForm, setGuardiaForm] = useState(EMPTY_GUARDIA);
  const [guardiaError, setGuardiaError] = useState('');
  const [savingGuardia, setSavingGuardia] = useState(false);

  const [importarAbierto, setImportarAbierto] = useState(false);
  const [conexionesAbierto, setConexionesAbierto] = useState(false);

  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    if (!token) return;
    if (!silencioso) setLoading(true);
    setLoadError('');
    try {
      const lista = await apiRequest('/guardias', { token });
      setGuardias(Array.isArray(lista) ? lista : []);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // RUT que ya están en la base, para avisar en la vista previa de la carga masiva.
  const rutsExistentes = useMemo(() => new Set(guardias.map((guardia) => normalizeRut(guardia.rut))), [guardias]);

  const activos = useMemo(
    () => guardias.filter((guardia) => guardia.activo !== false).length,
    [guardias]
  );

  const abrirGuardiaNuevo = () => {
    setGuardiaForm({ ...EMPTY_GUARDIA, fecha_contrato: todayISO() });
    setGuardiaEditor('new');
    setGuardiaError('');
  };

  const abrirGuardiaEditar = (guardia) => {
    setGuardiaForm(toGuardiaForm(guardia));
    setGuardiaEditor(guardia);
    setGuardiaError('');
  };

  const guardarGuardia = async (event) => {
    event.preventDefault();
    setGuardiaError('');
    const rut = normalizeRut(guardiaForm.rut);
    const horas = Number(guardiaForm.horas_semanales_max);

    if (!guardiaForm.nombre_completo.trim()) {
      return setGuardiaError('Ingresa el nombre completo del trabajador.');
    }
    if (!RUT_RE.test(rut)) {
      return setGuardiaError('Ingresa un RUT válido, por ejemplo 18.123.456-7.');
    }
    if (!Number.isFinite(horas) || horas < 1 || horas > 60) {
      return setGuardiaError('La jornada semanal debe estar entre 1 y 60 horas.');
    }
    if (guardiaForm.email && !EMAIL_RE.test(guardiaForm.email.trim())) {
      return setGuardiaError('Ingresa un correo válido o déjalo vacío.');
    }

    const payload = {
      nombre_completo: guardiaForm.nombre_completo.trim(),
      rut,
      cargo: guardiaForm.cargo.trim() || null,
      email: guardiaForm.email.trim() || null,
      telefono: guardiaForm.telefono.trim() || null,
      fecha_contrato: guardiaForm.fecha_contrato || null,
      horas_semanales_max: Math.round(horas),
      activo: Boolean(guardiaForm.activo),
    };

    setSavingGuardia(true);
    try {
      if (guardiaEditor === 'new') {
        await apiRequest('/guardias', { method: 'POST', token, body: payload });
        notify('Trabajador agregado a la base de la empresa.');
      } else {
        await apiRequest(`/guardias/${guardiaEditor.id}`, {
          method: 'PUT',
          token,
          body: payload,
        });
        notify('Trabajador actualizado.');
      }
      setGuardiaEditor(null);
      await cargar();
    } catch (error) {
      setGuardiaError(error.message);
    } finally {
      setSavingGuardia(false);
    }
  };

  const alternarGuardia = async (guardia) => {
    try {
      await apiRequest(`/guardias/${guardia.id}`, {
        method: 'PUT',
        token,
        body: {
          nombre_completo: guardia.nombre_completo,
          rut: guardia.rut,
          cargo: guardia.cargo,
          email: guardia.email,
          telefono: guardia.telefono,
          fecha_contrato: dateInput(guardia.fecha_contrato) || null,
          horas_semanales_max: guardia.horas_semanales_max,
          activo: guardia.activo === false,
        },
      });
      await cargar();
    } catch (error) {
      notify(error.message, 'error');
    }
  };

  const eliminarGuardia = async (guardia) => {
    if (!window.confirm(`¿Eliminar a ${guardia.nombre_completo} de la base de trabajadores?`)) return;
    try {
      await apiRequest(`/guardias/${guardia.id}`, { method: 'DELETE', token });
      notify('Trabajador eliminado de la base.', 'info');
      await cargar();
    } catch (error) {
      notify(error.message, 'error');
    }
  };

  if (loading && !guardias.length && !loadError) {
    return (
      <div className="page company-page">
        <div className="master-loading">
          <span className="master-loading-ring" />
          <div>
            <strong>Cargando trabajadores…</strong>
            <p>Base de datos de trabajadores de tu empresa.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loadError && !guardias.length) {
    return (
      <div className="page company-page">
        <div className="master-error">
          <AlertTriangle size={26} />
          <div>
            <strong>No se pudo cargar la base de trabajadores</strong>
            <p>{loadError}</p>
          </div>
          <Button variant="secondary" icon={RefreshCw} onClick={cargar}>
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  const contratoPromedio = guardias.length
    ? Math.round(
        guardias.reduce((total, guardia) => total + (Number(guardia.horas_semanales_max) || 42), 0) /
          guardias.length
      )
    : 0;

  return (
    <div className="page company-page">
      <div className="stat-grid stat-grid-compact">
        <Stat label="Trabajadores" value={guardias.length} hint="En la base de datos de tu empresa" icon={Users} />
        <Stat
          label="Activos"
          value={activos}
          hint={guardias.length - activos ? `${guardias.length - activos} inactivos no se importan` : 'Todos disponibles para planificar'}
          icon={UserCheck}
          tone="ok"
        />
        <Stat
          label="Jornada promedio"
          value={guardias.length ? `${contratoPromedio} h` : '—'}
          hint="Horas semanales de contrato"
          icon={ShieldCheck}
        />
      </div>

      <Card
        title="Base de datos de trabajadores"
        subtitle="Registra a tus trabajadores una sola vez. Cada planificación toma desde aquí a las personas que participan."
        actions={
          <div className="card-actions-row">
            <Badge tone="neutral">{activos} activos de {guardias.length}</Badge>
            <Button
              size="sm"
              variant="secondary"
              icon={Plug}
              onClick={() => setConexionesAbierto(true)}
              hidden={readOnly}
              title="Conecta otros sistemas para traer a tus trabajadores"
            >
              Conectar otra aplicación
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={FileSpreadsheet}
              onClick={() => setImportarAbierto(true)}
              hidden={readOnly}
            >
              Cargar desde Excel
            </Button>
            <Button size="sm" icon={Plus} onClick={abrirGuardiaNuevo} hidden={readOnly}>Agregar trabajador</Button>
          </div>
        }
        noPadding
      >
        {guardias.length ? (
          <div className="table-wrap">
            <table className="data-table company-table">
              <thead>
                <tr>
                  <th>Trabajador</th>
                  <th>RUT</th>
                  <th>Contacto</th>
                  <th>Contrato</th>
                  <th>Estado</th>
                  <th className="actions-col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {guardias.map((guardia, index) => (
                  <tr key={guardia.id} className={guardia.activo === false ? 'row-muted' : ''}>
                    <td>
                      <div className="person-cell">
                        <Avatar
                          name={guardia.nombre_completo}
                          color={guardia.color || ['#0f766e', '#0284c7', '#7c3aed', '#db2777'][index % 4]}
                          size={34}
                        />
                        <div>
                          <strong>{guardia.nombre_completo}</strong>
                          <span>{guardia.cargo || 'Sin cargo definido'}</span>
                          {guardia.numero_certificado ? (
                            <span className="cell-sub">OS-10 · {guardia.numero_certificado}</span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td>{guardia.rut}</td>
                    <td>
                      <div className="company-contact-cell">
                        {guardia.email ? <span><Mail size={13} /> {guardia.email}</span> : null}
                        {guardia.telefono ? <span><Phone size={13} /> {guardia.telefono}</span> : null}
                        {!guardia.email && !guardia.telefono ? <span className="muted">Sin contacto</span> : null}
                      </div>
                    </td>
                    <td>
                      <strong>{guardia.horas_semanales_max || 42} h</strong>
                      <div className="cell-sub">
                        {guardia.fecha_contrato ? `Desde ${dateLabel(guardia.fecha_contrato)}` : 'Sin fecha'}
                      </div>
                    </td>
                    <td>
                      <Badge tone={guardia.activo === false ? 'neutral' : 'ok'} dot>
                        {guardia.activo === false ? 'Inactivo' : 'Activo'}
                      </Badge>
                    </td>
                    <td className="actions-col">
                      <div className="row-actions" hidden={readOnly}>
                        <button
                          type="button"
                          className="icon-btn"
                          title="Editar trabajador"
                          onClick={() => abrirGuardiaEditar(guardia)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          title={guardia.activo === false ? 'Activar' : 'Desactivar'}
                          onClick={() => alternarGuardia(guardia)}
                        >
                          <Power size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn danger"
                          title="Eliminar trabajador"
                          onClick={() => eliminarGuardia(guardia)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Users}
            title="Tu base de trabajadores está vacía"
            description="Súbelas todas juntas desde un Excel o agrégalas una a una. Después podrás traerlas a cada planificación desde Dotación."
            action={
              readOnly ? null : (
                <div className="empty-actions">
                  <Button icon={FileSpreadsheet} onClick={() => setImportarAbierto(true)}>Cargar desde Excel</Button>
                  <Button variant="secondary" icon={Plus} onClick={abrirGuardiaNuevo}>Agregar primer trabajador</Button>
                </div>
              )
            }
          />
        )}
      </Card>

      <div className="company-note-grid">
        <div className="company-note">
          <CalendarRange size={18} />
          <div>
            <strong>Una base, muchas planificaciones</strong>
            <span>Los trabajadores se cargan una vez. Al crear una planificación puedes traerlos con un clic.</span>
          </div>
        </div>
        <div className="company-note">
          <ShieldCheck size={18} />
          <div>
            <strong>Datos aislados</strong>
            <span>Esta base solo es visible para los usuarios de tu empresa.</span>
          </div>
        </div>
        <Link className="company-note company-note-link" to="/personal">
          <ArrowRight size={18} />
          <div>
            <strong>Ir a la dotación</strong>
            <span>Revisa quiénes participan en la planificación activa.</span>
          </div>
        </Link>
      </div>

      <ImportarTrabajadores
        open={importarAbierto}
        onClose={() => setImportarAbierto(false)}
        existentes={rutsExistentes}
        token={token}
        onDone={(respuesta) => {
          if (respuesta?.creados) cargar({ silencioso: true });
        }}
      />
      <ConexionesModal
        open={conexionesAbierto}
        onClose={() => setConexionesAbierto(false)}
        onCargarExcel={() => {
          setConexionesAbierto(false);
          setImportarAbierto(true);
        }}
      />

      <Modal
        open={Boolean(guardiaEditor)}
        onClose={() => setGuardiaEditor(null)}
        title={guardiaEditor === 'new' ? 'Agregar trabajador' : `Editar a ${guardiaEditor?.nombre_completo || ''}`}
        subtitle="Estos datos forman la base de trabajadores de tu empresa."
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setGuardiaEditor(null)}>Cancelar</Button>
            <Button icon={Save} onClick={guardarGuardia} disabled={savingGuardia}>
              {savingGuardia ? 'Guardando…' : guardiaEditor === 'new' ? 'Agregar trabajador' : 'Guardar cambios'}
            </Button>
          </>
        }
      >
        <form className="form-grid" onSubmit={guardarGuardia}>
          <Field label="Nombre completo" className="field-full">
            <input
              className="input"
              value={guardiaForm.nombre_completo}
              onChange={(event) => setGuardiaForm((previous) => ({ ...previous, nombre_completo: event.target.value }))}
              placeholder="Camila Rojas"
            />
          </Field>
          <Field label="RUT">
            <input
              className="input"
              value={guardiaForm.rut}
              onChange={(event) => setGuardiaForm((previous) => ({ ...previous, rut: event.target.value }))}
              placeholder="18.123.456-7"
            />
          </Field>
          <Field label="Cargo o rol">
            <input
              className="input"
              value={guardiaForm.cargo}
              onChange={(event) => setGuardiaForm((previous) => ({ ...previous, cargo: event.target.value }))}
              placeholder="Guardia de seguridad"
            />
          </Field>
          <Field label="Correo">
            <input
              className="input"
              type="email"
              value={guardiaForm.email}
              onChange={(event) => setGuardiaForm((previous) => ({ ...previous, email: event.target.value }))}
              placeholder="persona@empresa.cl"
            />
          </Field>
          <Field label="Teléfono">
            <input
              className="input"
              value={guardiaForm.telefono}
              onChange={(event) => setGuardiaForm((previous) => ({ ...previous, telefono: event.target.value }))}
              placeholder="+56 9 1234 5678"
            />
          </Field>
          <Field label="Fecha de contrato">
            <input
              className="input"
              type="date"
              value={guardiaForm.fecha_contrato}
              onChange={(event) => setGuardiaForm((previous) => ({ ...previous, fecha_contrato: event.target.value }))}
            />
          </Field>
          <Field label="Jornada semanal (h)" hint="Horas de contrato, no necesariamente las horas planificadas.">
            <input
              className="input"
              type="number"
              min="1"
              max="60"
              value={guardiaForm.horas_semanales_max}
              onChange={(event) => setGuardiaForm((previous) => ({ ...previous, horas_semanales_max: event.target.value }))}
            />
          </Field>
          <div className="field-full">
            <Toggle
              checked={guardiaForm.activo}
              onChange={(checked) => setGuardiaForm((previous) => ({ ...previous, activo: checked }))}
              label="Trabajador activo"
              description="Solo los trabajadores activos se traen a las planificaciones."
            />
          </div>
          {guardiaError ? <div className="form-error field-full">{guardiaError}</div> : null}
        </form>
      </Modal>
    </div>
  );
}
