import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  KeyRound,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import { apiRequest, useAuth } from '../store/AuthContext.jsx';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
} from '../components/ui.jsx';
import './usuarios.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ROLES = {
  operador: {
    label: 'Acceso de la empresa',
    tone: 'info',
    description: 'Es el acceso con el que se creó la empresa. Tiene todos los permisos y no se puede desactivar.',
  },
  admin: {
    label: 'Administrador',
    tone: 'ok',
    description:
      'Gestiona usuarios, datos de la empresa, personal y horarios. También puede aprobar.',
  },
  validador: {
    label: 'Validador',
    tone: 'warn',
    description:
      'Ve toda la operación y aprueba horarios y solicitudes del personal. No modifica datos.',
  },
};

const ASSIGNABLE = ['admin', 'validador'];
const EMPTY_FORM = { nombre: '', email: '', rol: 'admin' };
const COLORS = ['#0f766e', '#0284c7', '#7c3aed', '#db2777', '#b45309', '#059669'];

function RolePicker({ value, onChange }) {
  return (
    <div className="role-picker" role="radiogroup" aria-label="Rol">
      {ASSIGNABLE.map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          className={`role-option ${value === id ? 'is-selected' : ''}`}
          onClick={() => onChange(id)}
        >
          <span className="role-option-head">
            {id === 'admin' ? <ShieldCheck size={16} /> : <UserCheck size={16} />}
            <strong>{ROLES[id].label}</strong>
            {value === id ? <Check size={15} className="role-option-check" /> : null}
          </span>
          <span>{ROLES[id].description}</span>
        </button>
      ))}
    </div>
  );
}

export default function Usuarios() {
  const { token, session } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [maxUsuarios, setMaxUsuarios] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editor, setEditor] = useState(null); // 'new' | usuario
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [credencial, setCredencial] = useState(null); // { nombre, email, clave }
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await apiRequest('/usuarios', { token });
      setUsuarios(data.usuarios || []);
      setMaxUsuarios(data.max_usuarios ?? null);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const activos = usuarios.filter((usuario) => usuario.activo).length;
  const limiteAlcanzado = maxUsuarios !== null && activos >= maxUsuarios;

  const abrirNuevo = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setEditor('new');
  };

  const abrirEditar = (usuario) => {
    setForm({ nombre: usuario.nombre, email: usuario.email, rol: usuario.rol });
    setFormError('');
    setEditor(usuario);
  };

  const guardar = async () => {
    setFormError('');
    if (!form.nombre.trim()) return setFormError('Ingresa el nombre de la persona.');
    if (editor === 'new' && !EMAIL_RE.test(form.email.trim())) {
      return setFormError('Ingresa un correo válido.');
    }
    setSaving(true);
    try {
      if (editor === 'new') {
        const data = await apiRequest('/usuarios', {
          method: 'POST',
          token,
          body: { nombre: form.nombre.trim(), email: form.email.trim(), rol: form.rol },
        });
        setEditor(null);
        setCredencial({
          nombre: data.usuario.nombre,
          email: data.usuario.email,
          clave: data.clave_temporal,
          nuevo: true,
        });
      } else {
        const body = { nombre: form.nombre.trim() };
        if (editor.rol !== 'operador') body.rol = form.rol;
        await apiRequest(`/usuarios/${editor.id}`, { method: 'PATCH', token, body });
        setEditor(null);
      }
      await cargar();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const alternar = async (usuario) => {
    setActionError('');
    const verbo = usuario.activo ? 'desactivar' : 'activar';
    if (!window.confirm(`¿Quieres ${verbo} la cuenta de ${usuario.nombre}?`)) return;
    try {
      await apiRequest(`/usuarios/${usuario.id}`, {
        method: 'PATCH',
        token,
        body: { activo: !usuario.activo },
      });
      await cargar();
    } catch (error) {
      setActionError(error.message);
    }
  };

  const restablecer = async (usuario) => {
    setActionError('');
    if (
      !window.confirm(
        `Se generará una clave temporal para ${usuario.nombre} y la actual dejará de servir. ¿Continuar?`
      )
    ) {
      return;
    }
    try {
      const data = await apiRequest(`/usuarios/${usuario.id}/restablecer-clave`, {
        method: 'POST',
        token,
      });
      setCredencial({
        nombre: usuario.nombre,
        email: usuario.email,
        clave: data.clave_temporal,
        nuevo: false,
      });
      await cargar();
    } catch (error) {
      setActionError(error.message);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(credencial.clave);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles: la clave queda visible para copiarla a mano.
    }
  };

  const cerrarCredencial = () => {
    setCredencial(null);
    setCopied(false);
  };

  return (
    <div className="page users-page">
      <div className="users-roles">
        {Object.entries(ROLES).map(([id, role]) => (
          <div className="users-role-card" key={id}>
            <Badge tone={role.tone}>{role.label}</Badge>
            <p>{role.description}</p>
          </div>
        ))}
      </div>

      {actionError ? <div className="form-error">{actionError}</div> : null}

      <Card
        title="Usuarios de la empresa"
        subtitle="Quienes administran y validan la operación. El personal no accede a TURNSOFT: recibe sus turnos de ti o de quien designes."
        actions={
          <div className="card-actions-row">
            <Badge tone="neutral">
              {activos}
              {maxUsuarios !== null ? ` de ${maxUsuarios}` : ''} {activos === 1 && maxUsuarios === null ? 'activo' : 'activos'}
            </Badge>
            <Button size="sm" icon={Plus} onClick={abrirNuevo} disabled={limiteAlcanzado}>
              Agregar usuario
            </Button>
          </div>
        }
        noPadding
      >
        {loadError ? (
          <div className="master-error">
            <AlertTriangle size={26} />
            <div>
              <strong>No se pudo cargar la lista</strong>
              <p>{loadError}</p>
            </div>
            <Button variant="secondary" icon={RefreshCw} onClick={cargar}>
              Reintentar
            </Button>
          </div>
        ) : loading && !usuarios.length ? (
          <div className="users-loading">Cargando usuarios…</div>
        ) : usuarios.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Persona</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th className="actions-col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((usuario, index) => {
                  const role = ROLES[usuario.rol] || ROLES.admin;
                  const esEmpresa = usuario.rol === 'operador';
                  const esYo = String(usuario.id) === String(session?.id);
                  const puedeEditar = !esEmpresa || esYo;
                  return (
                    <tr key={usuario.id} className={usuario.activo ? '' : 'row-muted'}>
                      <td>
                        <div className="person-cell">
                          <Avatar name={usuario.nombre} color={COLORS[index % COLORS.length]} size={34} />
                          <div>
                            <strong>{esYo ? `${usuario.nombre} (tú)` : usuario.nombre}</strong>
                            <span>{usuario.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge tone={role.tone}>{role.label}</Badge>
                      </td>
                      <td>
                        {usuario.debe_cambiar_clave ? (
                          <Badge tone="warn" dot>Clave temporal pendiente</Badge>
                        ) : (
                          <Badge tone={usuario.activo ? 'ok' : 'neutral'} dot>
                            {usuario.activo ? 'Activo' : 'Desactivado'}
                          </Badge>
                        )}
                      </td>
                      <td className="actions-col">
                        <div className="row-actions">
                          {puedeEditar ? (
                            <button
                              type="button"
                              className="icon-btn"
                              title="Editar"
                              onClick={() => abrirEditar(usuario)}
                            >
                              <Pencil size={16} />
                            </button>
                          ) : null}
                          {!esEmpresa && !esYo ? (
                            <>
                              <button
                                type="button"
                                className="icon-btn"
                                title="Restablecer clave"
                                onClick={() => restablecer(usuario)}
                              >
                                <KeyRound size={16} />
                              </button>
                              <button
                                type="button"
                                className="icon-btn"
                                title={usuario.activo ? 'Desactivar' : 'Activar'}
                                onClick={() => alternar(usuario)}
                              >
                                <Power size={16} />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Users}
            title="Aún no hay usuarios"
            description="Agrega administradores y validadores para repartir el trabajo."
          />
        )}
        {limiteAlcanzado ? (
          <p className="users-limit">
            Tu plan permite hasta {maxUsuarios} usuarios de gestión. Desactiva uno para agregar otro.
          </p>
        ) : null}
      </Card>

      <Modal
        open={Boolean(editor)}
        title={editor === 'new' ? 'Agregar usuario' : 'Editar usuario'}
        subtitle={
          editor === 'new'
            ? 'Recibirá una clave temporal que deberá cambiar al entrar.'
            : editor?.email
        }
        onClose={() => setEditor(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditor(null)}>Cancelar</Button>
            <Button onClick={guardar} disabled={saving}>
              {saving ? 'Guardando…' : editor === 'new' ? 'Crear usuario' : 'Guardar cambios'}
            </Button>
          </>
        }
      >
        <div className="users-form">
          {formError ? <div className="form-error">{formError}</div> : null}
          <Field label="Nombre completo">
            <input
              className="input"
              value={form.nombre}
              onChange={(event) => setForm((previous) => ({ ...previous, nombre: event.target.value }))}
              placeholder="Nombre y apellido"
              autoComplete="off"
            />
          </Field>
          {editor === 'new' ? (
            <Field label="Correo de acceso" hint="Con este correo entrará a TURNSOFT.">
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))}
                placeholder="persona@empresa.cl"
                autoComplete="off"
              />
            </Field>
          ) : null}
          {editor?.rol !== 'operador' ? (
            <div className="field">
              <span className="field-label">Rol</span>
              <RolePicker
                value={form.rol}
                onChange={(rol) => setForm((previous) => ({ ...previous, rol }))}
              />
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(credencial)}
        title={credencial?.nuevo ? 'Usuario creado' : 'Clave restablecida'}
        subtitle="Entrega estos datos a la persona. La clave se muestra solo una vez."
        onClose={cerrarCredencial}
        footer={<Button onClick={cerrarCredencial}>Listo, ya la copié</Button>}
      >
        {credencial ? (
          <div className="users-credential">
            <dl>
              <div>
                <dt>Persona</dt>
                <dd>{credencial.nombre}</dd>
              </div>
              <div>
                <dt>Correo</dt>
                <dd>{credencial.email}</dd>
              </div>
              <div>
                <dt>Clave temporal</dt>
                <dd className="users-credential-key">
                  <code>{credencial.clave}</code>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={copied ? Check : Copy}
                    onClick={copiar}
                  >
                    {copied ? 'Copiada' : 'Copiar'}
                  </Button>
                </dd>
              </div>
            </dl>
            <p className="users-credential-note">
              Al ingresar por primera vez, TURNSOFT le pedirá crear su propia clave.
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
