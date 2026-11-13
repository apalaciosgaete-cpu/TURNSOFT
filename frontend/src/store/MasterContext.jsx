import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { apiRequest } from './AuthContext.jsx';
import { useAuth } from './AuthContext.jsx';

const MasterContext = createContext(null);

const EMPTY = {
  resumen: null,
  empresas: [],
  planes: [],
  pagos: [],
  tickets: [],
};

export function MasterProvider({ children }) {
  const { token, isSuperadmin } = useAuth();
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const timer = useRef(null);

  const dismissNotice = useCallback(() => setNotice(null), []);

  const notify = useCallback((message, tone = 'success') => {
    if (timer.current) window.clearTimeout(timer.current);
    setNotice({ message, tone, id: Date.now() });
    timer.current = window.setTimeout(() => setNotice(null), 4600);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );

  const refresh = useCallback(
    async ({ quiet = false } = {}) => {
      if (!token || !isSuperadmin) return;
      if (!quiet) setLoading(true);
      setError('');
      try {
        const [resumen, empresas, planes, pagos, tickets] = await Promise.all([
          apiRequest('/master/resumen', { token }),
          apiRequest('/master/empresas', { token }),
          apiRequest('/master/planes', { token }),
          apiRequest('/master/pagos', { token }),
          apiRequest('/master/soporte', { token }),
        ]);
        setData({
          resumen,
          empresas: Array.isArray(empresas) ? empresas : [],
          planes: Array.isArray(planes) ? planes : [],
          pagos: Array.isArray(pagos) ? pagos : [],
          tickets: Array.isArray(tickets) ? tickets : [],
        });
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    },
    [token, isSuperadmin]
  );

  useEffect(() => {
    if (!isSuperadmin) {
      setData(EMPTY);
      setLoading(false);
      return;
    }
    refresh();
  }, [isSuperadmin, refresh]);

  const run = useCallback(
    async (path, { method = 'POST', body, successMessage } = {}) => {
      const result = await apiRequest(path, { token, method, body });
      await refresh({ quiet: true });
      if (successMessage) notify(successMessage);
      return result;
    },
    [token, refresh, notify]
  );

  const actions = useMemo(
    () => ({
      refresh,
      updateEmpresa: (id, payload) =>
        run(`/master/empresas/${id}`, {
          method: 'PATCH',
          body: payload,
          successMessage:
            payload?.estado === 'suspendida'
              ? 'Empresa bloqueada. Sus usuarios ya no podrán ingresar.'
              : payload?.estado === 'activa'
                ? 'Empresa activada. Sus usuarios ya tienen acceso.'
                : payload?.estado === 'vencida'
                  ? 'Empresa marcada como prueba vencida.'
                  : 'Empresa actualizada.',
        }),
      createPlan: (payload) =>
        run('/master/planes', { body: payload, successMessage: 'Plan creado.' }),
      updatePlan: (id, payload) =>
        run(`/master/planes/${id}`, {
          method: 'PATCH',
          body: payload,
          successMessage: 'Plan actualizado.',
        }),
      createPago: (payload) =>
        run('/master/pagos', { body: payload, successMessage: 'Pago registrado.' }),
      updatePago: (id, payload) =>
        run(`/master/pagos/${id}`, {
          method: 'PATCH',
          body: payload,
          successMessage:
            payload?.estado === 'pagado' ? 'Pago verificado.' : 'Pago actualizado.',
        }),
      updateTicket: (id, payload) =>
        run(`/master/soporte/${id}`, {
          method: 'PATCH',
          body: payload,
          successMessage: 'Ticket actualizado.',
        }),
    }),
    [run, refresh]
  );

  const value = useMemo(
    () => ({
      ...data,
      loading,
      error,
      notice,
      dismissNotice,
      notify,
      ...actions,
    }),
    [data, loading, error, notice, dismissNotice, notify, actions]
  );

  return <MasterContext.Provider value={value}>{children}</MasterContext.Provider>;
}

export function useMaster() {
  const context = useContext(MasterContext);
  if (!context) throw new Error('useMaster debe usarse dentro de MasterProvider');
  return context;
}
