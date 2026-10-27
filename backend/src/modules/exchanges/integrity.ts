import { types } from 'node:util';
import { AvailabilityStatus } from '../../common/enums/record-status.enum';
import { MAX_CREDITS, reservationCost } from './credits';
import {
  ExchangeState,
  Movement,
  RequestStatus,
  Reservation,
  ReservationStatus,
} from './exchange.types';

export interface IntegrityIssue {
  code: string;
  ids: string[];
}

const validBalance = (value: number) =>
  Number.isInteger(value) && value >= 0 && value <= MAX_CREDITS;
const validAmount = (value: number) => validBalance(value) && value > 0;
const validDate = (value: Date | null): value is Date =>
  types.isDate(value) && Number.isFinite(value.getTime());
const sameDate = (left: Date, right: Date) =>
  validDate(left) && validDate(right) && left.getTime() === right.getTime();

function groupBy<T>(
  records: T[],
  key: (record: T) => string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const record of records) {
    const id = key(record);
    const group = groups.get(id) ?? [];
    group.push(record);
    groups.set(id, group);
  }
  return groups;
}

/**
 * Verifica que los snapshots formen una sola cadena que termine en el usuario.
 * Usa el grafo del ledger: registros del mismo milisegundo pueden llegar desde
 * PostgreSQL en cualquier orden, sin alterar su significado ni inventar fechas.
 */
function validLedgerChain(
  records: Movement[],
  balance: number,
  retained: number,
): boolean {
  if (!records.length) return true;
  const key = (saldo: number, retenidos: number) => `${saldo}:${retenidos}`;
  const edges = new Map<string, string[]>();
  const degrees = new Map<string, number>();
  for (const record of records) {
    const from = key(record.saldo_anterior, record.retenidos_anterior);
    const to = key(record.saldo_posterior, record.retenidos_posterior);
    edges.set(from, [...(edges.get(from) ?? []), to]);
    degrees.set(from, (degrees.get(from) ?? 0) + 1);
    degrees.set(to, (degrees.get(to) ?? 0) - 1);
  }
  const starts = [...degrees].filter(([, degree]) => degree === 1);
  const ends = [...degrees].filter(([, degree]) => degree === -1);
  if (
    [...degrees.values()].some((value) => Math.abs(value) > 1) ||
    starts.length > 1 ||
    ends.length !== starts.length
  )
    return false;
  const target = key(balance, retained);
  if (ends.length && ends[0]![0] !== target) return false;
  const stack = [starts[0]?.[0] ?? target];
  const path: string[] = [];
  while (stack.length) {
    const next = edges.get(stack[stack.length - 1]!)?.pop();
    if (next !== undefined) stack.push(next);
    else path.push(stack.pop()!);
  }
  return path.length === records.length + 1 && path[0] === target;
}

/** Auditoria pura de las entidades oficiales de las 12 tablas optimizadas. */
export function inspectIntegrity(state: ExchangeState): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const report = (code: string, ...ids: string[]) => {
    issues.push({ code, ids });
  };
  const reservations = [...state.reservations.values()];
  const movements = [...state.movements.values()];
  const byUser = groupBy(movements, (item) => item.id_usuario);
  const byReservation = groupBy(
    movements.filter((item) => item.id_reserva !== null),
    (item) => item.id_reserva!,
  );
  const byRequest = groupBy(
    reservations.filter((item) => item.id_solicitud !== null),
    (item) => item.id_solicitud!,
  );
  const movementTypes = new Set([
    'BonoInicial',
    'Recompensa',
    'Penalizacion',
    'Transferencia',
    'Ajuste',
    'Retencion',
    'Liberacion',
    'Consumo',
  ]);

  for (const [userId, user] of state.users) {
    if (user.id_usuario !== userId) report('USER_KEY_MISMATCH', userId);
    if (
      !validBalance(user.saldo) ||
      !validBalance(user.creditos_retenidos) ||
      user.creditos_retenidos > user.saldo
    )
      report('USER_INVALID_BALANCE', userId);
    const ledger = byUser.get(userId) ?? [];
    if (!validLedgerChain(ledger, user.saldo, user.creditos_retenidos))
      report('USER_LEDGER_SNAPSHOT_CHAIN_MISMATCH', userId);
    const expectedRetained = reservations.reduce(
      (sum, reservation) =>
        reservation.id_solicitante === userId &&
        reservation.estado === ReservationStatus.CONFIRMADA &&
        validAmount(reservation.creditos)
          ? sum + reservation.creditos
          : sum,
      0,
    );
    if (user.creditos_retenidos !== expectedRetained)
      report('USER_RESERVATION_RETAINED_MISMATCH', userId);
  }

  const movementKeys = new Set<string>();
  for (const [movementKey, movement] of state.movements) {
    const id = movement.id_movimiento;
    if (movementKey !== id) report('MOVEMENT_KEY_MISMATCH', id, movementKey);
    if (!state.users.has(movement.id_usuario))
      report('MOVEMENT_USER_NOT_FOUND', id, movement.id_usuario);
    if (
      !Number.isInteger(movement.cantidad) ||
      movement.cantidad === 0 ||
      Math.abs(movement.cantidad) > MAX_CREDITS
    )
      report('MOVEMENT_INVALID_AMOUNT', id);
    if (!movementTypes.has(movement.tipo)) report('MOVEMENT_INVALID_TYPE', id);
    if (!validDate(movement.created_at)) report('MOVEMENT_INVALID_DATE', id);
    if (
      ![
        movement.saldo_anterior,
        movement.saldo_posterior,
        movement.retenidos_anterior,
        movement.retenidos_posterior,
      ].every(validBalance) ||
      movement.retenidos_anterior > movement.saldo_anterior ||
      movement.retenidos_posterior > movement.saldo_posterior
    )
      report('MOVEMENT_INVALID_SNAPSHOT', id);
    let balanceDelta = movement.cantidad;
    let retainedDelta = 0;
    if (movement.tipo === 'Retencion') {
      balanceDelta = 0;
      retainedDelta = movement.cantidad;
    }
    if (movement.tipo === 'Liberacion') {
      balanceDelta = 0;
      retainedDelta = -movement.cantidad;
    }
    if (movement.tipo === 'Consumo') retainedDelta = movement.cantidad;
    if (
      movement.saldo_posterior - movement.saldo_anterior !== balanceDelta ||
      movement.retenidos_posterior - movement.retenidos_anterior !==
        retainedDelta
    )
      report('MOVEMENT_SNAPSHOT_DELTA_MISMATCH', id);
    if (
      ([
        'Retencion',
        'Liberacion',
        'BonoInicial',
        'Recompensa',
        'Transferencia',
      ].includes(movement.tipo) &&
        movement.cantidad <= 0) ||
      (['Consumo', 'Penalizacion'].includes(movement.tipo) &&
        movement.cantidad >= 0)
    )
      report('MOVEMENT_INVALID_SIGN', id);
    if (movement.id_reserva === null) {
      if (
        ['Retencion', 'Liberacion', 'Consumo', 'Transferencia'].includes(
          movement.tipo,
        )
      )
        report('MOVEMENT_RESERVATION_REQUIRED', id);
      continue;
    }
    const eventKey = `${movement.id_reserva}:${movement.tipo}:${movement.id_usuario}`;
    if (movementKeys.has(eventKey))
      report('DUPLICATE_RESERVATION_MOVEMENT', id, movement.id_reserva);
    movementKeys.add(eventKey);
    const reservation = state.reservations.get(movement.id_reserva);
    if (!reservation) {
      report('MOVEMENT_RESERVATION_NOT_FOUND', id, movement.id_reserva);
      continue;
    }
    if (
      ['Retencion', 'Liberacion', 'Consumo', 'Transferencia'].includes(
        movement.tipo,
      )
    ) {
      const expectedUser =
        movement.tipo === 'Transferencia'
          ? reservation.id_ofertante
          : reservation.id_solicitante;
      if (movement.id_usuario !== expectedUser)
        report('MOVEMENT_USER_MISMATCH', id, reservation.id_reserva);
      const expectedAmount =
        movement.tipo === 'Consumo'
          ? -reservation.creditos
          : reservation.creditos;
      if (movement.cantidad !== expectedAmount)
        report(
          'MOVEMENT_RESERVATION_AMOUNT_MISMATCH',
          id,
          reservation.id_reserva,
        );
    }
  }

  for (const [requestId, records] of byRequest) {
    if (records.length > 1)
      report(
        'DUPLICATE_RESERVATION_FOR_REQUEST',
        requestId,
        ...records.map((item) => item.id_reserva),
      );
  }
  for (const [key, request] of state.requests) {
    if (key !== request.id_solicitud) report('REQUEST_KEY_MISMATCH', key);
    for (const userId of [request.id_solicitante, request.id_ofertante])
      if (!state.users.has(userId))
        report('REQUEST_USER_NOT_FOUND', key, userId);
    if (request.id_solicitante === request.id_ofertante)
      report('REQUEST_SAME_PARTICIPANT', key);
    if (!Object.values(RequestStatus).includes(request.estado))
      report('REQUEST_INVALID_STATUS', key);
    try {
      if (
        reservationCost(
          request.fecha_inicio_propuesta,
          request.fecha_fin_propuesta,
        ) !== request.creditos_requeridos
      )
        report('REQUEST_COST_MISMATCH', key);
    } catch {
      report('REQUEST_INVALID_INTERVAL', key);
    }
    if (
      request.estado === RequestStatus.ACEPTADA &&
      (byRequest.get(key) ?? []).length !== 1
    )
      report('ACCEPTED_REQUEST_WITHOUT_RESERVATION', key);
    if (
      (request.estado === RequestStatus.PENDIENTE) !==
      (request.respondida_at === null)
    )
      report('REQUEST_RESPONSE_TIMESTAMP_MISMATCH', key);
  }

  for (const [key, reservation] of state.reservations) {
    const id = reservation.id_reserva;
    if (key !== id) report('RESERVATION_KEY_MISMATCH', id, key);
    const request = reservation.id_solicitud
      ? state.requests.get(reservation.id_solicitud)
      : null;
    if (reservation.id_solicitud && !request)
      report('RESERVATION_REQUEST_NOT_FOUND', id, reservation.id_solicitud);
    else if (
      request &&
      (request.estado !== RequestStatus.ACEPTADA ||
        request.id_solicitante !== reservation.id_solicitante ||
        request.id_ofertante !== reservation.id_ofertante ||
        request.id_habilidad !== reservation.id_habilidad ||
        request.creditos_requeridos !== reservation.creditos ||
        !sameDate(request.fecha_inicio_propuesta, reservation.fecha_inicio) ||
        !sameDate(request.fecha_fin_propuesta, reservation.fecha_fin))
    )
      report('RESERVATION_REQUEST_MISMATCH', id, request.id_solicitud);
    if (reservation.id_solicitante === reservation.id_ofertante)
      report('RESERVATION_SAME_PARTICIPANT', id);
    for (const userId of [reservation.id_solicitante, reservation.id_ofertante])
      if (!state.users.has(userId))
        report('RESERVATION_USER_NOT_FOUND', id, userId);
    const metadata = state.reservationMetadata.get(id);
    if (metadata) {
      const availability = state.availability.get(metadata.availabilityId);
      if (!availability)
        report(
          'RESERVATION_AVAILABILITY_NOT_FOUND',
          id,
          metadata.availabilityId,
        );
      else if (availability.id_usuario !== reservation.id_ofertante)
        report(
          'RESERVATION_AVAILABILITY_OWNER_MISMATCH',
          id,
          metadata.availabilityId,
        );
      else if (
        reservation.estado === ReservationStatus.CONFIRMADA &&
        (availability.estado !== AvailabilityStatus.DISPONIBLE ||
          !validDate(availability.fecha_inicio) ||
          !validDate(availability.fecha_fin) ||
          availability.fecha_inicio > reservation.fecha_inicio ||
          availability.fecha_fin < reservation.fecha_fin)
      )
        report(
          'CONFIRMED_RESERVATION_OUTSIDE_ACTIVE_AVAILABILITY',
          id,
          metadata.availabilityId,
        );
    }
    try {
      if (
        reservationCost(reservation.fecha_inicio, reservation.fecha_fin) !==
        reservation.creditos
      )
        report('RESERVATION_COST_MISMATCH', id);
    } catch {
      report('RESERVATION_INVALID_INTERVAL', id);
    }
    if (!validAmount(reservation.creditos))
      report('RESERVATION_INVALID_AMOUNT', id);
    if (!['Presencial', 'Virtual', 'Hibrida'].includes(reservation.modalidad))
      report('RESERVATION_INVALID_MODALITY', id);
    const both =
      validDate(reservation.confirmacion_solicitante_at) &&
      validDate(reservation.confirmacion_ofertante_at);
    for (const confirmation of [
      reservation.confirmacion_solicitante_at,
      reservation.confirmacion_ofertante_at,
    ])
      if (
        confirmation !== null &&
        (!validDate(confirmation) || confirmation < reservation.fecha_fin)
      )
        report('RESERVATION_INVALID_CONFIRMATION_DATE', id);
    let expected: Movement['tipo'][];
    switch (reservation.estado) {
      case ReservationStatus.CONFIRMADA:
        expected = ['Retencion'];
        if (both) report('CONFIRMED_RESERVATION_HAS_BOTH_CONFIRMATIONS', id);
        break;
      case ReservationStatus.COMPLETADA:
        expected = ['Retencion', 'Consumo', 'Transferencia'];
        if (!both) report('COMPLETED_RESERVATION_CONFIRMATIONS_MISMATCH', id);
        if (
          !validDate(reservation.completed_at) ||
          reservation.completed_at < reservation.fecha_fin
        )
          report('COMPLETED_RESERVATION_TIMESTAMP_MISMATCH', id);
        break;
      case ReservationStatus.CANCELADA:
        expected = ['Retencion', 'Liberacion'];
        if (
          !validDate(reservation.cancelled_at) ||
          !reservation.cancelado_por ||
          !reservation.motivo_cancelacion?.trim() ||
          !Number.isInteger(reservation.horas_anticipacion_cancelacion) ||
          (reservation.horas_anticipacion_cancelacion ?? -1) < 0
        )
          report('CANCELLED_RESERVATION_CANCELLATION_MISMATCH', id);
        if (
          reservation.cancelado_por &&
          !state.users.has(reservation.cancelado_por)
        )
          report('CANCELLATION_USER_NOT_FOUND', id);
        if (
          reservation.cancelado_por !== reservation.id_solicitante &&
          reservation.cancelado_por !== reservation.id_ofertante &&
          state.users.get(reservation.cancelado_por ?? '')?.rol !==
            'Administrador'
        )
          report('CANCELLATION_NON_PARTICIPANT', id);
        if (
          validDate(reservation.cancelled_at) &&
          reservation.horas_anticipacion_cancelacion !==
            Math.max(
              0,
              Math.floor(
                (reservation.fecha_inicio.getTime() -
                  reservation.cancelled_at.getTime()) /
                  3_600_000,
              ),
            )
        )
          report('CANCELLATION_NOTICE_MISMATCH', id);
        break;
      default:
        expected = [];
        report('RESERVATION_INVALID_STATUS', id);
    }
    if (
      reservation.estado !== ReservationStatus.COMPLETADA &&
      reservation.completed_at !== null
    )
      report('UNSETTLED_RESERVATION_HAS_COMPLETION', id);
    if (
      reservation.estado !== ReservationStatus.CANCELADA &&
      (reservation.cancelado_por !== null ||
        reservation.cancelled_at !== null ||
        reservation.motivo_cancelacion !== null ||
        reservation.horas_anticipacion_cancelacion !== null)
    )
      report('ACTIVE_RESERVATION_HAS_CANCELLATION', id);
    const events = (byReservation.get(id) ?? []).filter((item) =>
      ['Retencion', 'Liberacion', 'Consumo', 'Transferencia'].includes(
        item.tipo,
      ),
    );
    if (
      events.length !== expected.length ||
      expected.some((type) => !events.some((event) => event.tipo === type))
    )
      report('RESERVATION_LEDGER_EVENTS_MISMATCH', id);
  }

  const occupiedByUser = new Map<string, Reservation[]>();
  for (const reservation of reservations) {
    if (
      reservation.estado === ReservationStatus.CANCELADA ||
      !validDate(reservation.fecha_inicio) ||
      !validDate(reservation.fecha_fin) ||
      reservation.fecha_inicio >= reservation.fecha_fin
    )
      continue;
    for (const userId of new Set([
      reservation.id_solicitante,
      reservation.id_ofertante,
    ])) {
      const occupied = occupiedByUser.get(userId) ?? [];
      occupied.push(reservation);
      occupiedByUser.set(userId, occupied);
    }
  }
  for (const [userId, occupied] of occupiedByUser) {
    occupied.sort(
      (left, right) =>
        left.fecha_inicio.getTime() - right.fecha_inicio.getTime(),
    );
    let active: Reservation[] = [];
    for (const reservation of occupied) {
      active = active.filter(
        (item) => item.fecha_fin > reservation.fecha_inicio,
      );
      for (const conflict of active)
        report(
          'PARTICIPANT_RESERVATION_OVERLAP',
          userId,
          conflict.id_reserva,
          reservation.id_reserva,
        );
      active.push(reservation);
    }
  }
  return issues;
}
