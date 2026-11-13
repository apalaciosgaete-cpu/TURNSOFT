import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const SESSION_KEY = 'turnsoft.session.v3';
const API_BASE = import.meta.env.VITE_API_URL || '/api';
const REQUEST_TIMEOUT = 90000;

class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest(path, { token, method = 'GET', body } = {}) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiError(
        data.error || `Error del servidor (${response.status}).`,
        response.status,
        data.code
      );
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ApiError('El servidor tardó demasiado en responder. Intenta de nuevo.', 0);
    }
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      'No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.',
      0
    );
  } finally {
    window.clearTimeout(timer);
  }
}

function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

/** Convierte la fila de PostgreSQL en el cliente que usa la interfaz. */
function mapDbClient(db) {
  const name = String(db.nombre || '').trim() || 'Cliente';
  return {
    id: db.id,
    dbId: db.id,
    name,
    legalName: db.razon_social || name,
    sector: db.sector || 'seguridad',
    contact: db.contacto || '',
    email: db.email || '',
    phone: db.telefono || '',
    address: db.direccion || '',
    city: db.ciudad || '',
    color: db.color || '#1d4ed8',
    active: db.activo !== false,
  };
}

function buildSession(user, dbClients, token, previous = null) {
  const isSuperadmin = user.rol === 'superadmin';
  const isOperator =
    !isSuperadmin && (!user.cliente_id || user.rol === 'operador' || user.rol === 'admin');
  const mapped = (dbClients || []).map(mapDbClient);
  const clients = isSuperadmin
    ? []
    : isOperator
      ? mapped
      : mapped.filter((client) => client.dbId === user.cliente_id);

  const ownClient = !isOperator && !isSuperadmin ? clients[0] || null : null;
  const previousActive =
    previous?.activeClientId &&
    clients.some((client) => client.id === previous.activeClientId)
      ? previous.activeClientId
      : null;

  return {
    id: user.id,
    apiUser: user,
    email: user.email,
    name: user.nombre || user.email,
    role: isSuperadmin ? 'superadmin' : isOperator ? 'operador' : 'cliente',
    empresa: user.empresa_nombre || (isSuperadmin ? 'TURNSOFT' : 'Mi empresa'),
    empresaEstado: user.empresa_estado || null,
    pruebaFin: user.prueba_fin || null,
    planName: user.plan_nombre || null,
    clientId: ownClient?.id || null,
    clientName: ownClient?.name || user.cliente_nombre || null,
    activeClientId: isOperator ? previousActive : ownClient?.id || null,
    clients,
    token,
    initials: initials(user.nombre || user.email),
  };
}

function loadSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.role || !Array.isArray(parsed.clients)) return null;
    return parsed;
  } catch {
    return null;
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(loadSession);
  const [authError, setAuthError] = useState('');
  const [busy, setBusy] = useState(false);
  const [bootstrap, setBootstrap] = useState({
    loading: true,
    needsSetup: false,
    userCount: 0,
    unavailable: false,
  });

  useEffect(() => {
    try {
      if (session) {
        window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } else {
        window.localStorage.removeItem(SESSION_KEY);
      }
    } catch {
      // El almacenamiento local puede estar bloqueado; la sesión sigue en memoria.
    }
  }, [session]);

  const checkBootstrap = useCallback(async () => {
    setBootstrap((previous) => ({ ...previous, loading: true }));
    try {
      const data = await apiRequest('/auth/bootstrap');
      setBootstrap({
        loading: false,
        needsSetup: Boolean(data.needsSetup),
        userCount: Number(data.userCount) || 0,
        unavailable: false,
      });
    } catch {
      // Si el endpoint aún no está desplegado, el login normal sigue disponible.
      setBootstrap({
        loading: false,
        needsSetup: false,
        userCount: 0,
        unavailable: true,
      });
    }
  }, []);

  useEffect(() => {
    if (!session) checkBootstrap();
  }, [session, checkBootstrap]);

  // Revalida el token y refresca la lista de clientes visibles al abrir la app.
  useEffect(() => {
    const token = session?.token;
    if (!token) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const { user } = await apiRequest('/auth/me', { token });
        const dbClients =
          user.rol === 'superadmin' ? [] : await apiRequest('/clientes', { token });
        if (!cancelled) {
          setSession((previous) =>
            previous && previous.token === token
              ? buildSession(user, dbClients, token, previous)
              : previous
          );
        }
      } catch (error) {
        if (!cancelled && error.status === 401) setSession(null);
        if (!cancelled && (error.code === 'EMPRESA_SUSPENDIDA' || error.code === 'PRUEBA_VENCIDA')) {
          setSession(null);
          setAuthError(error.message);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.token]);

  const login = useCallback(async (email, password) => {
    setBusy(true);
    setAuthError('');
    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: { email: String(email || '').trim(), password: String(password || '') },
      });
      const dbClients =
        data.user.rol === 'superadmin'
          ? []
          : await apiRequest('/clientes', { token: data.token });
      setSession(buildSession(data.user, dbClients, data.token));
      return true;
    } catch (error) {
      setAuthError(
        error.status === 401 ? 'Correo o clave incorrectos.' : error.message
      );
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  /** Configuración inicial: crea la cuenta de supervisor maestro. */
  const setup = useCallback(async (payload) => {
    setBusy(true);
    setAuthError('');
    try {
      const data = await apiRequest('/auth/setup', { method: 'POST', body: payload });
      const dbClients =
        data.user.rol === 'superadmin'
          ? []
          : await apiRequest('/clientes', { token: data.token });
      setSession(buildSession(data.user, dbClients, data.token));
      setBootstrap({ loading: false, needsSetup: false, userCount: 1, unavailable: false });
      return true;
    } catch (error) {
      setAuthError(error.message);
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  /** Registro público: crea empresa, administrador y prueba de 15 días. */
  const register = useCallback(async (payload) => {
    setBusy(true);
    setAuthError('');
    try {
      const data = await apiRequest('/public/registro', { method: 'POST', body: payload });
      setSession(buildSession(data.user, [], data.token));
      setBootstrap({ loading: false, needsSetup: false, userCount: 1, unavailable: false });
      return true;
    } catch (error) {
      setAuthError(error.message);
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  /** Crea un cliente en PostgreSQL y refresca la lista de la sesión. */
  const createClient = useCallback(
    async (payload) => {
      if (!session?.token) {
        throw new ApiError('Tu sesión expiró. Vuelve a iniciar sesión.', 401);
      }
      const created = await apiRequest('/clientes', {
        method: 'POST',
        token: session.token,
        body: payload,
      });
      const [{ user }, dbClients] = await Promise.all([
        apiRequest('/auth/me', { token: session.token }),
        apiRequest('/clientes', { token: session.token }),
      ]);
      setSession((previous) =>
        previous && previous.token === session.token
          ? buildSession(user, dbClients, previous.token, previous)
          : previous
      );
      return created;
    },
    [session?.token]
  );

  const logout = useCallback(() => {
    setAuthError('');
    setSession(null);
  }, []);

  const selectClient = useCallback((clientId) => {
    setSession((previous) => {
      if (!previous || previous.role !== 'operador') return previous;
      const exists = previous.clients.some((client) => client.id === clientId);
      return { ...previous, activeClientId: exists ? clientId : null };
    });
  }, []);

  const clearAuthError = useCallback(() => setAuthError(''), []);

  const isOperator = session?.role === 'operador';
  const isSuperadmin = session?.role === 'superadmin';

  const clients = useMemo(() => session?.clients || [], [session]);

  const activeClient = useMemo(() => {
    if (!session) return null;
    if (isOperator) {
      return clients.find((client) => client.id === session.activeClientId) || null;
    }
    return clients.find((client) => client.id === session.clientId) || null;
  }, [session, isOperator, clients]);

  const value = useMemo(
    () => ({
      session,
      user: session,
      token: session?.token || null,
      busy,
      isOperator,
      isSuperadmin,
      clients,
      activeClient,
      activeClientId: session?.activeClientId || null,
      authError,
      bootstrap,
      checkBootstrap,
      clearAuthError,
      login,
      setup,
      register,
      createClient,
      logout,
      selectClient,
    }),
    [
      session,
      busy,
      isOperator,
      isSuperadmin,
      clients,
      activeClient,
      authError,
      bootstrap,
      checkBootstrap,
      clearAuthError,
      login,
      setup,
      register,
      createClient,
      logout,
      selectClient,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
