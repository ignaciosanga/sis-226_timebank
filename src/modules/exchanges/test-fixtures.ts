import { DatabaseRole } from '../../common/enums/role.enum';
import {
  AvailabilityStatus,
  UserStatus,
} from '../../common/enums/record-status.enum';
import { StoredUser } from '../users/user.types';
import {
  ExchangeState,
  Movement,
  RequestStatus,
  ReservationStatus,
} from './exchange.types';

export function storedUser(id: string, saldo = 0): StoredUser {
  return {
    id_usuario: id,
    nombre: id,
    apellido: 'Prueba',
    correo: `${id}@example.test`,
    password_hash: 'hash-for-test',
    rol: DatabaseRole.ESTUDIANTE,
    id_carrera: null,
    semestre: null,
    saldo,
    creditos_retenidos: 0,
    fecha_registro: new Date('2029-01-01T00:00:00Z'),
    ultimo_acceso: null,
    estado: UserStatus.ACTIVO,
  };
}

export function addMovement(
  state: ExchangeState,
  id: string,
  userId: string,
  tipo: Movement['tipo'],
  amount: number,
  reservationId: string | null = null,
  at = new Date('2029-12-31T00:00:00Z'),
): void {
  const user = state.users.get(userId)!;
  const record: Movement = {
    id_movimiento: id,
    id_usuario: userId,
    id_reserva: reservationId,
    tipo,
    cantidad: amount,
    saldo_anterior: user.saldo,
    saldo_posterior: user.saldo,
    retenidos_anterior: user.creditos_retenidos,
    retenidos_posterior: user.creditos_retenidos,
    created_at: at,
    descripcion: null,
  };
  if (tipo === 'Retencion') user.creditos_retenidos += amount;
  else if (tipo === 'Liberacion') user.creditos_retenidos -= amount;
  else {
    user.saldo += amount;
    if (tipo === 'Consumo') user.creditos_retenidos += amount;
  }
  record.saldo_posterior = user.saldo;
  record.retenidos_posterior = user.creditos_retenidos;
  state.movements.set(id, record);
}

export function addUser(state: ExchangeState, userId: string): void {
  if (state.users.has(userId)) return;
  state.users.set(userId, storedUser(userId));
  addMovement(state, `grant-${userId}`, userId, 'BonoInicial', 40);
}

export function addReservation(
  state: ExchangeState,
  {
    id = 'r1',
    requester = 'student',
    provider = 'provider',
    hour = 10,
    status = ReservationStatus.CONFIRMADA,
  }: {
    id?: string;
    requester?: string;
    provider?: string;
    hour?: number;
    status?: ReservationStatus;
  } = {},
): void {
  addUser(state, requester);
  addUser(state, provider);
  const start = new Date(Date.UTC(2030, 0, 1, hour));
  const end = new Date(start.getTime() + 3_600_000);
  const availabilityId = `availability-${provider}`;
  state.availability.set(availabilityId, {
    id_disponibilidad: availabilityId,
    id_usuario: provider,
    fecha_inicio: new Date('2030-01-01T00:00:00Z'),
    fecha_fin: new Date('2030-01-02T00:00:00Z'),
    estado: AvailabilityStatus.DISPONIBLE,
  });
  state.requests.set(`request-${id}`, {
    id_solicitud: `request-${id}`,
    id_solicitante: requester,
    id_ofertante: provider,
    id_habilidad: 'skill',
    fecha_inicio_propuesta: start,
    fecha_fin_propuesta: end,
    creditos_requeridos: 4,
    estado: RequestStatus.ACEPTADA,
    created_at: new Date('2029-12-31T00:00:00Z'),
    respondida_at: new Date('2029-12-31T00:00:00Z'),
  });
  state.requestMetadata.set(`request-${id}`, {
    availabilityId,
    descripcion: 'Prueba',
  });
  const reservation = {
    id_reserva: id,
    id_solicitud: `request-${id}`,
    id_solicitante: requester,
    id_ofertante: provider,
    id_habilidad: 'skill',
    fecha_inicio: start,
    fecha_fin: end,
    creditos: 4,
    modalidad: 'Virtual' as const,
    lugar: 'Por coordinar',
    estado: status,
    confirmacion_solicitante_at: null as Date | null,
    confirmacion_ofertante_at: null as Date | null,
    cancelado_por: null as string | null,
    motivo_cancelacion: null as string | null,
    horas_anticipacion_cancelacion: null as number | null,
    created_at: new Date('2029-12-31T00:00:00Z'),
    completed_at: null as Date | null,
    cancelled_at: null as Date | null,
  };
  state.reservations.set(id, reservation);
  state.reservationMetadata.set(id, { availabilityId, administrativa: false });
  addMovement(state, `hold-${id}`, requester, 'Retencion', 4, id);
  if (status === ReservationStatus.COMPLETADA) {
    addMovement(state, `Consumo-${id}`, requester, 'Consumo', -4, id, end);
    addMovement(
      state,
      `Transferencia-${id}`,
      provider,
      'Transferencia',
      4,
      id,
      end,
    );
    reservation.confirmacion_solicitante_at = end;
    reservation.confirmacion_ofertante_at = end;
    reservation.completed_at = end;
  } else if (status === ReservationStatus.CANCELADA) {
    addMovement(state, `release-${id}`, requester, 'Liberacion', 4, id, start);
    reservation.cancelado_por = requester;
    reservation.motivo_cancelacion = 'Cancelacion de prueba';
    reservation.cancelled_at = start;
    reservation.horas_anticipacion_cancelacion = 0;
  }
}
