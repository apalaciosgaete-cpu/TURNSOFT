/**
 * Novedades laborales sobre un horario ya generado:
 * - ausencia: total o de medio turno.
 * - swap: cambio de día libre (permuta de descanso).
 * - coverage: cobertura de una inasistencia con otra persona.
 *
 * Las novedades viven a nivel de escenario (`scenario.exceptions`) y sus
 * efectos se reflejan en las celdas del horario. Las funciones de este módulo
 * son puras para poder probarlas y para que el frontend y el backend usen la
 * misma semántica.
 */

export const EXCEPTION_LABELS = {
  absence: 'Ausencia',
  swap: 'Cambio de día libre',
  coverage: 'Cobertura',
};

export const PORTION_LABELS = {
  full: 'Día completo',
  half: 'Medio turno',
};

export function getExceptions(scenario) {
  return Array.isArray(scenario?.exceptions) ? scenario.exceptions : [];
}

export function findException(scenario, exceptionId) {
  return getExceptions(scenario).find((exception) => exception.id === exceptionId) || null;
}

export function isHalfAbsence(cell) {
  return cell?.type === 'absence' && cell.portion === 'half';
}

/** Fracción de jornada efectivamente trabajada en una celda. */
export function cellWorkedFraction(cell) {
  if (!cell) return 0;
  if (cell.type === 'shift') return 1;
  if (cell.type === 'absence' && cell.portion === 'half') return 0.5;
  return 0;
}

/** Fracción de cupo cubierta por la celda (0, 0,5 o 1). */
export function cellCoverageFraction(cell) {
  return cellWorkedFraction(cell);
}

export function formatSlotValue(value) {
  if (!Number.isFinite(value)) return '0';
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1).replace('.', ',');
}

export function exceptionDate(exception) {
  if (!exception) return '';
  if (exception.type === 'swap') {
    return [exception.offDate, exception.workDate].filter(Boolean).sort()[0] || '';
  }
  return exception.date || '';
}

/** Ordena novedades por fecha y luego por tipo. */
export function sortExceptions(exceptions) {
  return [...exceptions].sort((a, b) => {
    const dateCompare = exceptionDate(a).localeCompare(exceptionDate(b));
    if (dateCompare !== 0) return dateCompare;
    return String(a.type).localeCompare(String(b.type));
  });
}

function cloneCell(cell) {
  return cell ? JSON.parse(JSON.stringify(cell)) : { type: 'off' };
}

function setCell(cells, employeeId, date, cell) {
  return {
    ...cells,
    [employeeId]: {
      ...(cells?.[employeeId] || {}),
      [date]: cloneCell(cell),
    },
  };
}

/**
 * Quita las novedades que dependen de una celda antes de que el usuario la
 * edite manualmente. Restaura las celdas de reemplazo vinculadas cuando una
 * ausencia o cobertura deja de existir.
 */
export function detachExceptionsForCell({ cells, exceptions }, employeeId, date) {
  const safeCells = cells || {};
  const safeExceptions = exceptions || [];
  const droppedAbsences = new Set();
  const droppedCoverages = new Set();

  for (const exception of safeExceptions) {
    if (
      exception.type === 'absence' &&
      exception.employeeId === employeeId &&
      exception.date === date
    ) {
      droppedAbsences.add(exception.id);
    }
  }

  let nextCells = safeCells;
  for (const exception of safeExceptions) {
    if (exception.type !== 'coverage') continue;
    const touchesAbsent = exception.employeeId === employeeId && exception.date === date;
    const touchesReplacement =
      exception.replacementId === employeeId && exception.date === date;
    const linkedToDroppedAbsence = droppedAbsences.has(exception.absenceId);

    if (!touchesAbsent && !touchesReplacement && !linkedToDroppedAbsence) continue;
    droppedCoverages.add(exception.id);
    if (!touchesReplacement) {
      nextCells = setCell(
        nextCells,
        exception.replacementId,
        exception.date,
        exception.previousCell
      );
    }
  }

  const nextExceptions = safeExceptions.filter((exception) => {
    if (droppedAbsences.has(exception.id) || droppedCoverages.has(exception.id)) return false;
    if (
      exception.type === 'swap' &&
      exception.employeeId === employeeId &&
      (exception.offDate === date || exception.workDate === date)
    ) {
      return false;
    }
    return true;
  });

  return {
    cells: nextCells,
    exceptions: nextExceptions,
    removedIds: [...droppedAbsences, ...droppedCoverages],
  };
}

/**
 * Anula una novedad y revierte exactamente sus efectos. Si se anula una
 * ausencia, también se anulan las coberturas vinculadas.
 */
export function undoException({ cells, exceptions }, exceptionId) {
  const safeExceptions = exceptions || [];
  const target = safeExceptions.find((exception) => exception.id === exceptionId);
  if (!target) {
    return { cells: cells || {}, exceptions: safeExceptions, removedIds: [] };
  }

  let nextCells = cells || {};
  let nextExceptions = safeExceptions.filter((exception) => exception.id !== exceptionId);
  const removedIds = [exceptionId];

  if (target.type === 'absence') {
    const linkedCoverages = safeExceptions.filter(
      (exception) => exception.type === 'coverage' && exception.absenceId === exceptionId
    );
    for (const coverage of linkedCoverages) {
      nextCells = setCell(
        nextCells,
        coverage.replacementId,
        coverage.date,
        coverage.previousCell
      );
      nextExceptions = nextExceptions.filter((exception) => exception.id !== coverage.id);
      removedIds.push(coverage.id);
    }
    nextCells = setCell(
      nextCells,
      target.employeeId,
      target.date,
      target.previousCell || (target.shiftId ? { type: 'shift', shiftId: target.shiftId } : { type: 'off' })
    );
  } else if (target.type === 'coverage') {
    nextCells = setCell(
      nextCells,
      target.replacementId,
      target.date,
      target.previousCell || { type: 'off' }
    );
  } else if (target.type === 'swap') {
    nextCells = setCell(
      nextCells,
      target.employeeId,
      target.offDate,
      target.offCell || { type: 'off' }
    );
    nextCells = setCell(
      nextCells,
      target.employeeId,
      target.workDate,
      target.workCell || { type: 'off' }
    );
  }

  return { cells: nextCells, exceptions: nextExceptions, removedIds };
}

/** Resumen legible de una novedad, usado por la interfaz y los reportes. */
export function describeException(exception, { employeeMap, shiftMap } = {}) {
  if (!exception) return '';
  const employee = employeeMap?.get?.(exception.employeeId);
  const employeeName = employee?.name || 'Trabajador';
  if (exception.type === 'absence') {
    const portion = exception.portion === 'half' ? 'medio turno' : 'día completo';
    return `${employeeName}: ausencia de ${portion}.`;
  }
  if (exception.type === 'swap') {
    return `${employeeName}: descanso pasa del ${exception.offDate} al ${exception.workDate}.`;
  }
  if (exception.type === 'coverage') {
    const replacement = employeeMap?.get?.(exception.replacementId);
    const shift = shiftMap?.get?.(exception.shiftId);
    return `${replacement?.name || 'Reemplazo'} cubre a ${employeeName}${shift ? ` en ${shift.code}` : ''}.`;
  }
  return 'Novedad registrada.';
}
