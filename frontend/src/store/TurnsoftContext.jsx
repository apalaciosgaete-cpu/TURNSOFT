import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { generateSchedule } from '@shared/engine.js';
import { validateSchedule } from '@shared/validate.js';
import { buildConfigFingerprint, shiftCertificationsOk, hasCertification } from '@shared/model.js';
import { SECTOR_ENGINE_PRESETS, getSectorRules, getSectorShifts } from '@shared/presets.js';
import { addDays, eachDate, formatDateShort, todayISO, uid } from '@shared/dates.js';
import {
  detachExceptionsForCell,
  getExceptions,
  undoException,
} from '@shared/exceptions.js';
import { useAuth } from './AuthContext.jsx';

const STORAGE_PREFIX = 'turnsoft.workspace.v4';
const EMPLOYEE_COLORS = ['#0f766e', '#0284c7', '#7c3aed', '#db2777', '#b45309', '#059669', '#dc2626', '#475569', '#4338ca', '#0e7490'];

const TurnsoftContext = createContext(null);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function bumpScheduleMeta(schedule, edits = 1) {
  return {
    ...schedule,
    meta: {
      ...schedule.meta,
      manualEdits: (schedule.meta?.manualEdits || 0) + edits,
      editedAt: new Date().toISOString(),
    },
  };
}

function createFreshState() {
  return {
    version: 4,
    operator: null,
    clients: [],
    scenarios: [],
    activeScenarioId: null,
    activeClientId: null,
  };
}

function storageKeyFor(session) {
  if (!session) return null;
  return `${STORAGE_PREFIX}:${session.role}:${session.clientId || 'operador'}`;
}

/**
 * Un usuario cliente nunca conserva en su navegador escenarios de otros
 * clientes: el estado se recorta al cliente de la sesión antes de guardarse.
 */
function scopeState(state, session) {
  if (!session || session.role === 'operador') return state;
  const scenarios = state.scenarios.filter(
    (scenario) => scenario.clientId === session.clientId
  );
  return {
    ...state,
    scenarios,
    activeScenarioId: scenarios.some((scenario) => scenario.id === state.activeScenarioId)
      ? state.activeScenarioId
      : scenarios[0]?.id || null,
    activeClientId: session.clientId,
  };
}

function loadState(session) {
  const fresh = createFreshState();
  const key = storageKeyFor(session);
  if (typeof window === 'undefined' || !key) return fresh;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 4 || !Array.isArray(parsed.scenarios)) {
      return fresh;
    }

    const merged = scopeState({ ...fresh, ...parsed }, session);
    return {
      ...merged,
      activeScenarioId: merged.scenarios.some(
        (scenario) => scenario.id === merged.activeScenarioId
      )
        ? merged.activeScenarioId
        : merged.scenarios[0]?.id || null,
    };
  } catch {
    return fresh;
  }
}

function scenarioVisibleTo(scenario, session, isOperator, activeClientId) {
  if (!scenario || !session) return false;
  if (!isOperator) return scenario.clientId === session.clientId;
  return !activeClientId || scenario.clientId === activeClientId;
}

export function TurnsoftProvider({ children }) {
  const { session, isOperator, activeClientId, clients } = useAuth();
  const [state, setState] = useState(() => loadState(session));
  const [busyScenarioId, setBusyScenarioId] = useState(null);
  const [notice, setNotice] = useState(null);
  const noticeTimer = useRef(null);
  const generateTimer = useRef(null);

  useEffect(() => {
    setState(loadState(session));
  }, [session?.role, session?.clientId]);

  useEffect(() => {
    const key = storageKeyFor(session);
    if (!key) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Sin espacio o almacenamiento bloqueado: la app sigue funcionando en memoria.
    }
  }, [state, session]);

  useEffect(() => () => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    if (generateTimer.current) window.clearTimeout(generateTimer.current);
  }, []);

  const notify = useCallback((message, tone = 'success') => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    setNotice({ message, tone, id: Date.now() });
    noticeTimer.current = window.setTimeout(() => setNotice(null), 4200);
  }, []);

  const dismissNotice = useCallback(() => setNotice(null), []);

  const canAccessScenario = useCallback(
    (scenario) => scenarioVisibleTo(scenario, session, isOperator, activeClientId),
    [session, isOperator, activeClientId]
  );

  const findOwned = useCallback(
    (previous, scenarioId) => {
      const scenario = previous.scenarios.find((item) => item.id === scenarioId);
      return canAccessScenario(scenario) ? scenario : null;
    },
    [canAccessScenario]
  );

  const visibleScenarios = useMemo(() => {
    if (!session) return [];
    if (!isOperator) return state.scenarios.filter((scenario) => scenario.clientId === session.clientId);
    if (activeClientId) return state.scenarios.filter((scenario) => scenario.clientId === activeClientId);
    return state.scenarios;
  }, [state.scenarios, session, isOperator, activeClientId]);

  const activeScenarioId = useMemo(() => {
    if (!visibleScenarios.length) return null;
    if (visibleScenarios.some((scenario) => scenario.id === state.activeScenarioId)) {
      return state.activeScenarioId;
    }
    return visibleScenarios[0].id;
  }, [visibleScenarios, state.activeScenarioId]);

  const activeScenario = useMemo(
    () => visibleScenarios.find((scenario) => scenario.id === activeScenarioId) || null,
    [visibleScenarios, activeScenarioId]
  );

  const activeValidation = useMemo(
    () => (activeScenario ? validateSchedule(activeScenario, activeScenario.schedule) : null),
    [activeScenario]
  );

  const visibleClients = useMemo(() => {
    if (!session) return [];
    if (isOperator) return clients;
    return clients.filter((client) => client.id === session.clientId);
  }, [session, isOperator, clients]);

  const activeClient = useMemo(() => {
    if (!session) return null;
    const targetId = isOperator ? activeClientId : session.clientId;
    return clients.find((client) => client.id === targetId) || null;
  }, [session, isOperator, activeClientId, clients]);

  const clientSummaries = useMemo(
    () =>
      visibleClients.map((client) => {
        const scenarios = state.scenarios.filter((scenario) => scenario.clientId === client.id);
        const scheduled = scenarios.filter((scenario) => scenario.schedule);
        const latest = scenarios[0] || null;
        return {
          ...client,
          scenarioCount: scenarios.length,
          scheduledCount: scheduled.length,
          lastScenario: latest?.name || null,
          lastPeriod: latest ? `${latest.startDate} · ${latest.days} días` : null,
        };
      }),
    [visibleClients, state.scenarios]
  );

  const selectScenario = useCallback(
    (scenarioId) => {
      setState((previous) => {
        if (!findOwned(previous, scenarioId)) return previous;
        return { ...previous, activeScenarioId: scenarioId };
      });
    },
    [findOwned]
  );

  const updateScenario = useCallback(
    (scenarioId, patch) => {
      setState((previous) => {
        if (!findOwned(previous, scenarioId)) return previous;
        return {
          ...previous,
          scenarios: previous.scenarios.map((scenario) => {
            if (scenario.id !== scenarioId) return scenario;
            const changes = typeof patch === 'function' ? patch(scenario) : patch;
            return { ...scenario, ...changes };
          }),
        };
      });
    },
    [findOwned]
  );

  const updateScenarioMeta = useCallback(
    (scenarioId, meta) => {
      setState((previous) => {
        if (!findOwned(previous, scenarioId)) return previous;
        return {
          ...previous,
          scenarios: previous.scenarios.map((scenario) => {
            if (scenario.id !== scenarioId) return scenario;
            const periodChanged =
              (meta.startDate !== undefined && meta.startDate !== scenario.startDate) ||
              (meta.days !== undefined && Number(meta.days) !== Number(scenario.days));
            return {
              ...scenario,
              ...meta,
              days: meta.days !== undefined ? Number(meta.days) : scenario.days,
              schedule: periodChanged ? null : scenario.schedule,
              exceptions: periodChanged ? [] : getExceptions(scenario),
            };
          }),
        };
      });
    },
    [findOwned]
  );

  const generate = useCallback(
    (scenarioId) => {
      const targetId = scenarioId || activeScenario?.id;
      if (!targetId) return;
      if (generateTimer.current) window.clearTimeout(generateTimer.current);
      setBusyScenarioId(targetId);
      generateTimer.current = window.setTimeout(() => {
        setState((previous) => {
          if (!findOwned(previous, targetId)) return previous;
          return {
            ...previous,
            scenarios: previous.scenarios.map((scenario) => {
              if (scenario.id !== targetId) return scenario;
              const schedule = generateSchedule(scenario, { patternAttempts: 90, greedyAttempts: 60 });
              return { ...scenario, schedule, exceptions: [] };
            }),
          };
        });
        setBusyScenarioId(null);
        notify('Horario generado y validado. Las novedades manuales anteriores se reiniciaron.');
      }, 60);
    },
    [activeScenario, findOwned, notify]
  );

  const setCell = useCallback(
    (scenarioId, employeeId, date, shiftId) => {
      setState((previous) => {
        if (!findOwned(previous, scenarioId)) return previous;
        return {
          ...previous,
          scenarios: previous.scenarios.map((scenario) => {
            if (scenario.id !== scenarioId || !scenario.schedule) return scenario;
            const detached = detachExceptionsForCell(
              {
                cells: scenario.schedule.cells,
                exceptions: getExceptions(scenario),
              },
              employeeId,
              date
            );
            const employeeCells = detached.cells?.[employeeId] || {};
            const cells = {
              ...detached.cells,
              [employeeId]: {
                ...employeeCells,
                [date]: shiftId ? { type: 'shift', shiftId } : { type: 'off' },
              },
            };
            return {
              ...scenario,
              exceptions: detached.exceptions,
              schedule: {
                ...scenario.schedule,
                cells,
                meta: {
                  ...scenario.schedule.meta,
                  manualEdits: (scenario.schedule.meta?.manualEdits || 0) + 1,
                  editedAt: new Date().toISOString(),
                },
              },
            };
          }),
        };
      });
    },
    [findOwned]
  );

  const registerAbsence = useCallback(
    (scenarioId, { employeeId, date, portion = 'full', halfPeriod = 'first', reason = '' } = {}) => {
      const scenario = state.scenarios.find((item) => item.id === scenarioId);
      if (!scenario || !canAccessScenario(scenario)) {
        return { ok: false, error: 'No tienes acceso a este escenario.' };
      }
      if (!scenario.schedule) {
        return { ok: false, error: 'Genera el horario antes de registrar novedades.' };
      }
      const employee = (scenario.employees || []).find(
        (item) => item.id === employeeId && item.active !== false
      );
      if (!employee) return { ok: false, error: 'Selecciona un trabajador activo.' };

      const dates = eachDate(scenario.schedule.startDate, scenario.schedule.days);
      if (!dates.includes(date)) {
        return { ok: false, error: 'Selecciona una fecha dentro del período del horario.' };
      }
      if (!['full', 'half'].includes(portion)) {
        return { ok: false, error: 'Selecciona si la ausencia es de día completo o medio turno.' };
      }

      const cell = scenario.schedule.cells?.[employeeId]?.[date];
      if (!cell || cell.type === 'off') {
        return { ok: false, error: 'Ese día ya está libre; no hay turno que ausentar.' };
      }
      if (cell.type === 'absence') {
        return {
          ok: false,
          error: 'Ya hay una ausencia registrada ese día. Anúlala primero para cambiarla.',
        };
      }
      if (cell.type !== 'shift') {
        return { ok: false, error: 'La celda seleccionada no contiene un turno válido.' };
      }

      const exceptionId = uid('exc');
      const exception = {
        id: exceptionId,
        type: 'absence',
        employeeId,
        date,
        portion,
        halfPeriod: portion === 'half' ? (halfPeriod === 'second' ? 'second' : 'first') : '',
        reason: String(reason || '').trim(),
        shiftId: cell.shiftId,
        previousCell: clone(cell),
        createdAt: new Date().toISOString(),
        createdBy: session?.name || session?.email || '',
      };
      const absenceCell = {
        type: 'absence',
        portion: exception.portion,
        halfPeriod: exception.halfPeriod,
        shiftId: exception.shiftId,
        reason: exception.reason,
        exceptionId,
      };

      setState((previous) => {
        if (!findOwned(previous, scenarioId)) return previous;
        return {
          ...previous,
          scenarios: previous.scenarios.map((item) => {
            if (item.id !== scenarioId || !item.schedule) return item;
            const detached = detachExceptionsForCell(
              { cells: item.schedule.cells, exceptions: getExceptions(item) },
              employeeId,
              date
            );
            return {
              ...item,
              exceptions: [...detached.exceptions, exception],
              schedule: bumpScheduleMeta({
                ...item.schedule,
                cells: {
                  ...detached.cells,
                  [employeeId]: {
                    ...(detached.cells?.[employeeId] || {}),
                    [date]: absenceCell,
                  },
                },
              }),
            };
          }),
        };
      });
      notify(
        `${portion === 'half' ? 'Ausencia de medio turno' : 'Ausencia'} registrada para ${employee.name} el ${formatDateShort(date)}.`
      );
      return { ok: true };
    },
    [state.scenarios, canAccessScenario, findOwned, notify, session]
  );

  const swapRestDay = useCallback(
    (scenarioId, { employeeId, offDate, workDate, reason = '' } = {}) => {
      const scenario = state.scenarios.find((item) => item.id === scenarioId);
      if (!scenario || !canAccessScenario(scenario)) {
        return { ok: false, error: 'No tienes acceso a este escenario.' };
      }
      if (!scenario.schedule) {
        return { ok: false, error: 'Genera el horario antes de registrar novedades.' };
      }
      const employee = (scenario.employees || []).find(
        (item) => item.id === employeeId && item.active !== false
      );
      if (!employee) return { ok: false, error: 'Selecciona un trabajador activo.' };
      if (!offDate || !workDate || offDate === workDate) {
        return { ok: false, error: 'Selecciona dos fechas distintas para permutar el descanso.' };
      }

      const dates = eachDate(scenario.schedule.startDate, scenario.schedule.days);
      if (!dates.includes(offDate) || !dates.includes(workDate)) {
        return { ok: false, error: 'Ambas fechas deben estar dentro del período del horario.' };
      }

      const offCell = scenario.schedule.cells?.[employeeId]?.[offDate];
      const workCell = scenario.schedule.cells?.[employeeId]?.[workDate];
      if (offCell?.type !== 'off') {
        return { ok: false, error: 'El día libre actual debe estar marcado como libre.' };
      }
      if (workCell?.type !== 'shift') {
        return {
          ok: false,
          error: 'El nuevo día libre debe ser un día con turno asignado (no una ausencia).',
        };
      }

      const exception = {
        id: uid('exc'),
        type: 'swap',
        employeeId,
        offDate,
        workDate,
        offCell: clone(offCell),
        workCell: clone(workCell),
        reason: String(reason || '').trim(),
        createdAt: new Date().toISOString(),
        createdBy: session?.name || session?.email || '',
      };

      setState((previous) => {
        if (!findOwned(previous, scenarioId)) return previous;
        return {
          ...previous,
          scenarios: previous.scenarios.map((item) => {
            if (item.id !== scenarioId || !item.schedule) return item;
            const detachedOff = detachExceptionsForCell(
              { cells: item.schedule.cells, exceptions: getExceptions(item) },
              employeeId,
              offDate
            );
            const detached = detachExceptionsForCell(detachedOff, employeeId, workDate);
            return {
              ...item,
              exceptions: [...detached.exceptions, exception],
              schedule: bumpScheduleMeta({
                ...item.schedule,
                cells: {
                  ...detached.cells,
                  [employeeId]: {
                    ...(detached.cells?.[employeeId] || {}),
                    [offDate]: clone(workCell),
                    [workDate]: clone(offCell),
                  },
                },
              }),
            };
          }),
        };
      });
      notify(
        `Día libre permutado: ${employee.name} descansará el ${formatDateShort(workDate)} y trabajará el ${formatDateShort(offDate)}.`
      );
      return { ok: true };
    },
    [state.scenarios, canAccessScenario, findOwned, notify, session]
  );

  const coverAbsence = useCallback(
    (scenarioId, { employeeId, date, replacementId, reason = '' } = {}) => {
      const scenario = state.scenarios.find((item) => item.id === scenarioId);
      if (!scenario || !canAccessScenario(scenario)) {
        return { ok: false, error: 'No tienes acceso a este escenario.' };
      }
      if (!scenario.schedule) {
        return { ok: false, error: 'Genera el horario antes de registrar novedades.' };
      }
      const employee = (scenario.employees || []).find(
        (item) => item.id === employeeId && item.active !== false
      );
      const replacement = (scenario.employees || []).find(
        (item) => item.id === replacementId && item.active !== false
      );
      if (!employee || !replacement) {
        return { ok: false, error: 'Selecciona trabajadores activos para la cobertura.' };
      }
      if (employee.id === replacement.id) {
        return { ok: false, error: 'La persona que cubre debe ser distinta de la persona ausente.' };
      }

      const dates = eachDate(scenario.schedule.startDate, scenario.schedule.days);
      if (!dates.includes(date)) {
        return { ok: false, error: 'Selecciona una fecha dentro del período del horario.' };
      }

      const absentCell = scenario.schedule.cells?.[employeeId]?.[date];
      if (!absentCell || absentCell.type === 'off') {
        return { ok: false, error: 'Ese día está libre; no hay inasistencia que cubrir.' };
      }
      const shiftId = absentCell.shiftId;
      const shift = (scenario.shifts || []).find((item) => item.id === shiftId);
      if (!shift) {
        return { ok: false, error: 'No se encontró el turno que se debe cubrir.' };
      }

      const replacementCell = scenario.schedule.cells?.[replacementId]?.[date];
      if (replacementCell && replacementCell.type !== 'off') {
        return {
          ok: false,
          error: `${replacement.name} ya tiene un turno o ausencia ese día. Elige otra persona o libera su celda primero.`,
        };
      }

      if (!shiftCertificationsOk(replacement, shift, date, scenario.rules?.requireCertifications)) {
        const missing = (shift.requiredCertifications || []).filter(
          (name) => !hasCertification(replacement, name, date, true)
        );
        return {
          ok: false,
          error: `${replacement.name} no tiene vigente: ${missing.join(', ') || 'la certificación requerida'}.`,
        };
      }

      const existingAbsence = getExceptions(scenario).find(
        (exception) =>
          exception.type === 'absence' &&
          exception.employeeId === employeeId &&
          exception.date === date
      );
      const absenceException = existingAbsence || {
        id: uid('exc'),
        type: 'absence',
        employeeId,
        date,
        portion: 'full',
        halfPeriod: '',
        reason: String(reason || '').trim() || 'Inasistencia',
        shiftId,
        previousCell: clone(absentCell),
        createdAt: new Date().toISOString(),
        createdBy: session?.name || session?.email || '',
      };
      const absenceCell = {
        type: 'absence',
        portion: absenceException.portion || 'full',
        halfPeriod: absenceException.halfPeriod || '',
        shiftId,
        reason: absenceException.reason || String(reason || '').trim() || 'Inasistencia',
        exceptionId: absenceException.id,
      };
      const coverageException = {
        id: uid('cov'),
        type: 'coverage',
        employeeId,
        date,
        replacementId,
        shiftId,
        absenceId: absenceException.id,
        reason: String(reason || '').trim(),
        previousCell: clone(replacementCell || { type: 'off' }),
        createdAt: new Date().toISOString(),
        createdBy: session?.name || session?.email || '',
      };

      setState((previous) => {
        if (!findOwned(previous, scenarioId)) return previous;
        return {
          ...previous,
          scenarios: previous.scenarios.map((item) => {
            if (item.id !== scenarioId || !item.schedule) return item;
            let detached = detachExceptionsForCell(
              { cells: item.schedule.cells, exceptions: getExceptions(item) },
              employeeId,
              date
            );
            detached = detachExceptionsForCell(detached, replacementId, date);
            return {
              ...item,
              exceptions: [...detached.exceptions, absenceException, coverageException],
              schedule: bumpScheduleMeta({
                ...item.schedule,
                cells: {
                  ...detached.cells,
                  [employeeId]: {
                    ...(detached.cells?.[employeeId] || {}),
                    [date]: absenceCell,
                  },
                  [replacementId]: {
                    ...(detached.cells?.[replacementId] || {}),
                    [date]: { type: 'shift', shiftId },
                  },
                },
              }),
            };
          }),
        };
      });
      notify(
        `Cobertura asignada a ${replacement.name} para ${employee.name} el ${formatDateShort(date)}.`
      );
      return { ok: true };
    },
    [state.scenarios, canAccessScenario, findOwned, notify, session]
  );

  const removeException = useCallback(
    (scenarioId, exceptionId) => {
      const scenario = state.scenarios.find((item) => item.id === scenarioId);
      if (!scenario || !canAccessScenario(scenario)) {
        return { ok: false, error: 'No tienes acceso a este escenario.' };
      }
      if (!scenario.schedule) {
        return { ok: false, error: 'Este escenario no tiene horario.' };
      }
      if (!getExceptions(scenario).some((exception) => exception.id === exceptionId)) {
        return { ok: false, error: 'La novedad ya no existe.' };
      }

      setState((previous) => {
        if (!findOwned(previous, scenarioId)) return previous;
        return {
          ...previous,
          scenarios: previous.scenarios.map((item) => {
            if (item.id !== scenarioId || !item.schedule) return item;
            const undone = undoException(
              { cells: item.schedule.cells, exceptions: getExceptions(item) },
              exceptionId
            );
            return {
              ...item,
              exceptions: undone.exceptions,
              schedule: bumpScheduleMeta({ ...item.schedule, cells: undone.cells }),
            };
          }),
        };
      });
      notify('Novedad anulada y grilla restaurada.', 'info');
      return { ok: true };
    },
    [state.scenarios, canAccessScenario, findOwned, notify]
  );

  const updateRules = useCallback(
    (scenarioId, patch) => {
      setState((previous) => {
        if (!findOwned(previous, scenarioId)) return previous;
        return {
          ...previous,
          scenarios: previous.scenarios.map((scenario) =>
            scenario.id === scenarioId
              ? { ...scenario, rules: { ...scenario.rules, ...patch } }
              : scenario
          ),
        };
      });
    },
    [findOwned]
  );

  const resetRules = useCallback(
    (scenarioId) => {
      setState((previous) => {
        if (!findOwned(previous, scenarioId)) return previous;
        return {
          ...previous,
          scenarios: previous.scenarios.map((scenario) =>
            scenario.id === scenarioId ? { ...scenario, rules: getSectorRules(scenario.sector) } : scenario
          ),
        };
      });
    },
    [findOwned]
  );

  const updateShift = useCallback(
    (scenarioId, shiftId, patch) => {
      setState((previous) => {
        if (!findOwned(previous, scenarioId)) return previous;
        return {
          ...previous,
          scenarios: previous.scenarios.map((scenario) =>
            scenario.id === scenarioId
              ? {
                  ...scenario,
                  shifts: scenario.shifts.map((shift) =>
                    shift.id === shiftId ? { ...shift, ...patch } : shift
                  ),
                }
              : scenario
          ),
        };
      });
    },
    [findOwned]
  );

  const addShift = useCallback(
    (scenarioId, shift) => {
      const id = shift.id || uid('shift');
      setState((previous) => {
        if (!findOwned(previous, scenarioId)) return previous;
        return {
          ...previous,
          scenarios: previous.scenarios.map((scenario) =>
            scenario.id === scenarioId
              ? {
                  ...scenario,
                  shifts: [
                    ...scenario.shifts,
                    {
                      name: 'Nuevo turno',
                      code: 'T',
                      start: '09:00',
                      end: '18:00',
                      breakMinutes: 60,
                      color: '#0f766e',
                      night: false,
                      coverage: [1, 1, 1, 1, 1, 0, 0],
                      requiredCertifications: [],
                      ...shift,
                      id,
                    },
                  ],
                }
              : scenario
          ),
        };
      });
      return id;
    },
    [findOwned]
  );

  const removeShift = useCallback(
    (scenarioId, shiftId) => {
      setState((previous) => {
        if (!findOwned(previous, scenarioId)) return previous;
        return {
          ...previous,
          scenarios: previous.scenarios.map((scenario) => {
            if (scenario.id !== scenarioId) return scenario;
            const shifts = scenario.shifts.filter((shift) => shift.id !== shiftId);
            let schedule = scenario.schedule;
            let exceptions = getExceptions(scenario);
            if (schedule) {
              let working = { cells: schedule.cells || {}, exceptions };
              for (const exception of exceptions.filter((item) => item.shiftId === shiftId)) {
                working = undoException(working, exception.id);
              }
              exceptions = working.exceptions;
              const cells = {};
              for (const [employeeId, dates] of Object.entries(working.cells || {})) {
                cells[employeeId] = {};
                for (const [date, cell] of Object.entries(dates)) {
                  cells[employeeId][date] =
                    cell?.shiftId === shiftId ? { type: 'off' } : cell;
                }
              }
              schedule = { ...schedule, cells };
            }
            return { ...scenario, shifts, schedule, exceptions };
          }),
        };
      });
    },
    [findOwned]
  );

  const addEmployee = useCallback(
    (scenarioId, employee) => {
      const id = uid('emp');
      setState((previous) => {
        if (!findOwned(previous, scenarioId)) return previous;
        return {
          ...previous,
          scenarios: previous.scenarios.map((scenario) =>
            scenario.id === scenarioId
              ? {
                  ...scenario,
                  employees: [
                    ...scenario.employees,
                    {
                      name: 'Nuevo trabajador',
                      role: '',
                      weeklyContractHours: Number(scenario.rules?.maxWeeklyHours) || 42,
                      active: true,
                      certifications: [],
                      unavailableWeekdays: [],
                      preferredShiftIds: [],
                      phone: '',
                      startDate: todayISO(),
                      color: EMPLOYEE_COLORS[scenario.employees.length % EMPLOYEE_COLORS.length],
                      ...employee,
                      id,
                    },
                  ],
                }
              : scenario
          ),
        };
      });
      return id;
    },
    [findOwned]
  );

  const updateEmployee = useCallback(
    (scenarioId, employeeId, patch) => {
      setState((previous) => {
        if (!findOwned(previous, scenarioId)) return previous;
        return {
          ...previous,
          scenarios: previous.scenarios.map((scenario) =>
            scenario.id === scenarioId
              ? {
                  ...scenario,
                  employees: scenario.employees.map((employee) =>
                    employee.id === employeeId ? { ...employee, ...patch } : employee
                  ),
                }
              : scenario
          ),
        };
      });
    },
    [findOwned]
  );

  const removeEmployee = useCallback(
    (scenarioId, employeeId) => {
      setState((previous) => {
        if (!findOwned(previous, scenarioId)) return previous;
        return {
          ...previous,
          scenarios: previous.scenarios.map((scenario) => {
            if (scenario.id !== scenarioId) return scenario;
            let schedule = scenario.schedule;
            let exceptions = getExceptions(scenario);
            if (schedule) {
              let working = { cells: schedule.cells || {}, exceptions };
              for (const exception of [...exceptions]) {
                if (
                  exception.employeeId === employeeId ||
                  exception.replacementId === employeeId
                ) {
                  working = undoException(working, exception.id);
                }
              }
              exceptions = working.exceptions;
              const cells = { ...(working.cells || {}) };
              delete cells[employeeId];
              schedule = { ...schedule, cells };
            }
            return {
              ...scenario,
              employees: scenario.employees.filter((employee) => employee.id !== employeeId),
              schedule,
              exceptions,
            };
          }),
        };
      });
    },
    [findOwned]
  );

  const addScenario = useCallback(
    (data) => {
      if (!session) return null;
      const requestedClientId = data.clientId || null;
      const targetClientId = isOperator
        ? requestedClientId || activeClientId || null
        : session.clientId;
      const client = clients.find((item) => item.id === targetClientId);
      if (!client) {
        notify('Selecciona un cliente antes de crear el escenario.', 'error');
        return null;
      }

      const sector = data.sector || client.sector || 'seguridad';
      const engine = SECTOR_ENGINE_PRESETS[sector] || SECTOR_ENGINE_PRESETS.logistica;
      const id = uid('sc');
      const days = Number(data.days) || (sector === 'seguridad' ? 32 : 28);
      const startDate = data.startDate || todayISO();
      const location =
        data.location || [client.address, client.city].filter(Boolean).join(', ') || '';

      setState((previous) => ({
        ...previous,
        activeScenarioId: id,
        scenarios: [
          ...previous.scenarios,
          {
            id,
            name: data.name?.trim() || `Operación ${client.name}`,
            company: data.company?.trim() || client.legalName || client.name,
            location,
            sector,
            clientId: client.id,
            clientName: client.name,
            operatorName: session.empresa || '',
            startDate,
            endDate: addDays(startDate, days - 1),
            days,
            employees: [],
            shifts: getSectorShifts(sector),
            rules: getSectorRules(sector),
            holidays: [],
            regions: [],
            schedule: null,
            exceptions: [],
            pattern: engine.pattern,
            continuityBias: engine.continuityBias,
            notes: data.notes || '',
            createdAt: new Date().toISOString(),
          },
        ],
      }));
      notify(`Escenario creado para ${client.name}. Ajusta la dotación y genera el horario.`, 'info');
      return id;
    },
    [session, isOperator, activeClientId, clients, notify]
  );

  const duplicateScenario = useCallback(
    (scenarioId) => {
      setState((previous) => {
        const source = findOwned(previous, scenarioId);
        if (!source) return previous;
        const id = uid('sc');
        return {
          ...previous,
          activeScenarioId: id,
          scenarios: [
            ...previous.scenarios,
            {
              ...clone(source),
              id,
              name: `${source.name} (copia)`,
              schedule: null,
              exceptions: [],
              createdAt: new Date().toISOString(),
            },
          ],
        };
      });
      notify('Escenario duplicado. Genera un nuevo horario para la copia.', 'info');
    },
    [findOwned, notify]
  );

  const deleteScenario = useCallback(
    (scenarioId) => {
      setState((previous) => {
        const target = findOwned(previous, scenarioId);
        if (!target) return previous;

        const sameAccount = previous.scenarios.filter(
          (scenario) => scenario.clientId === target.clientId
        );
        if (sameAccount.length <= 1) return previous;

        const scenarios = previous.scenarios.filter((scenario) => scenario.id !== scenarioId);
        const remaining = scenarios.filter((scenario) =>
          scenarioVisibleTo(scenario, session, isOperator, activeClientId)
        );
        return {
          ...previous,
          scenarios,
          activeScenarioId:
            previous.activeScenarioId === scenarioId
              ? remaining[0]?.id || null
              : previous.activeScenarioId,
        };
      });
      notify('Escenario eliminado.', 'info');
    },
    [findOwned, notify, session, isOperator, activeClientId]
  );

  const isStale = useCallback((scenario) => {
    if (!scenario?.schedule) return false;
    return scenario.schedule.meta?.fingerprint !== buildConfigFingerprint(scenario);
  }, []);

  const validationFor = useCallback(
    (scenario) => validateSchedule(scenario, scenario.schedule),
    []
  );

  const viewState = useMemo(
    () => ({
      version: state.version,
      operator: state.operator,
      clients: visibleClients,
      scenarios: visibleScenarios,
      activeScenarioId,
      activeClientId,
    }),
    [state.version, state.operator, visibleClients, visibleScenarios, activeScenarioId, activeClientId]
  );

  const value = useMemo(
    () => ({
      state: viewState,
      scenarios: visibleScenarios,
      activeScenario,
      activeScenarioId,
      activeValidation,
      busyScenarioId,
      notice,
      notify,
      dismissNotice,
      selectScenario,
      updateScenario,
      updateScenarioMeta,
      generate,
      setCell,
      registerAbsence,
      swapRestDay,
      coverAbsence,
      removeException,
      updateRules,
      resetRules,
      updateShift,
      addShift,
      removeShift,
      addEmployee,
      updateEmployee,
      removeEmployee,
      addScenario,
      duplicateScenario,
      deleteScenario,
      isStale,
      validationFor,
      sectorShifts: getSectorShifts,
      sectorRules: getSectorRules,
      clients: visibleClients,
      activeClient,
      activeClientId,
      isOperator,
      clientSummaries,
      session,
    }),
    [
      viewState,
      visibleScenarios,
      activeScenario,
      activeScenarioId,
      activeValidation,
      busyScenarioId,
      notice,
      notify,
      dismissNotice,
      selectScenario,
      updateScenario,
      updateScenarioMeta,
      generate,
      setCell,
      registerAbsence,
      swapRestDay,
      coverAbsence,
      removeException,
      updateRules,
      resetRules,
      updateShift,
      addShift,
      removeShift,
      addEmployee,
      updateEmployee,
      removeEmployee,
      addScenario,
      duplicateScenario,
      deleteScenario,
      isStale,
      validationFor,
      visibleClients,
      activeClient,
      activeClientId,
      isOperator,
      clientSummaries,
      session,
    ]
  );

  return <TurnsoftContext.Provider value={value}>{children}</TurnsoftContext.Provider>;
}

export function useTurnsoft() {
  const context = useContext(TurnsoftContext);
  if (!context) throw new Error('useTurnsoft debe usarse dentro de TurnsoftProvider');
  return context;
}
