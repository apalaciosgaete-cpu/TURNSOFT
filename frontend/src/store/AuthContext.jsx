import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  CLIENTS,
  OPERATOR,
  getClientById,
  getDemoAccounts,
} from '@shared/tenants.js';

const SESSION_KEY = 'turnsoft.session.v1';
const DEMO_ACCOUNTS = getDemoAccounts();

function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function normalizeSession(raw) {
  if (!raw || typeof raw !== 'object' || !raw.email || !raw.role) return null;
  const account = DEMO_ACCOUNTS.find(
    (item) => item.email.toLowerCase() === String(raw.email).toLowerCase()
  );
  if (!account) return null;

  if (account.role === 'operador') {
    const activeClientId = getClientById(raw.activeClientId)?.id || null;
    return {
      id: account.id,
      email: account.email,
      name: account.name,
      role: 'operador',
      empresa: OPERATOR.name,
      clientId: null,
      clientName: null,
      activeClientId,
      initials: initials(account.name),
    };
  }

  const client = getClientById(account.clientId);
  if (!client) return null;
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    role: 'cliente',
    empresa: OPERATOR.name,
    clientId: client.id,
    clientName: client.name,
    activeClientId: client.id,
    initials: initials(account.name),
  };
}

function loadSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return normalizeSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(loadSession);
  const [authError, setAuthError] = useState('');

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

  const login = useCallback((email, password) => {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const account = DEMO_ACCOUNTS.find(
      (item) => item.email.toLowerCase() === normalizedEmail
    );

    if (!account || account.password !== password) {
      setAuthError('Correo o clave incorrectos. Usa una de las cuentas demo.');
      return false;
    }

    setAuthError('');
    setSession(normalizeSession(account));
    return true;
  }, []);

  const logout = useCallback(() => {
    setAuthError('');
    setSession(null);
  }, []);

  const selectClient = useCallback((clientId) => {
    setSession((previous) => {
      if (!previous || previous.role !== 'operador') return previous;
      const client = clientId ? getClientById(clientId) : null;
      return { ...previous, activeClientId: client?.id || null };
    });
  }, []);

  const clearAuthError = useCallback(() => setAuthError(''), []);

  const isOperator = session?.role === 'operador';

  const clients = useMemo(() => {
    if (!session) return [];
    if (isOperator) return CLIENTS;
    return CLIENTS.filter((client) => client.id === session.clientId);
  }, [session, isOperator]);

  const activeClient = useMemo(() => {
    if (!session) return null;
    if (isOperator) return getClientById(session.activeClientId);
    return getClientById(session.clientId);
  }, [session, isOperator]);

  const value = useMemo(
    () => ({
      session,
      user: session,
      isOperator,
      clients,
      activeClient,
      activeClientId: session?.activeClientId || null,
      authError,
      clearAuthError,
      login,
      logout,
      selectClient,
    }),
    [
      session,
      isOperator,
      clients,
      activeClient,
      authError,
      clearAuthError,
      login,
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
