import type { Availability } from '../availability/availability.types';
import type { UserSkill } from '../user-skills/user-skill.types';
import type { StoredUser } from '../users/user.types';

export enum RequestStatus {
  PENDIENTE = 'Solicitada',
  ACEPTADA = 'Aceptada',
  RECHAZADA = 'Rechazada',
  CANCELADA = 'Cancelada',
}

export enum ReservationStatus {
  CONFIRMADA = 'Confirmada',
  COMPLETADA = 'Completada',
  CANCELADA = 'Cancelada',
}

export interface ExchangeRequest {
  id_solicitud: string;
  id_solicitante: string;
  id_ofertante: string;
  id_habilidad: string;
  fecha_inicio_propuesta: Date;
  fecha_fin_propuesta: Date;
  creditos_requeridos: number;
  estado: RequestStatus;
  created_at: Date;
  respondida_at: Date | null;
}

export interface Reservation {
  id_reserva: string;
  id_solicitud: string | null;
  id_solicitante: string;
  id_ofertante: string;
  id_habilidad: string;
  fecha_inicio: Date;
  fecha_fin: Date;
  creditos: number;
  modalidad: 'Presencial' | 'Virtual' | 'Hibrida';
  lugar: string;
  estado: ReservationStatus;
  confirmacion_solicitante_at: Date | null;
  confirmacion_ofertante_at: Date | null;
  cancelado_por: string | null;
  motivo_cancelacion: string | null;
  horas_anticipacion_cancelacion: number | null;
  created_at: Date;
  completed_at: Date | null;
  cancelled_at: Date | null;
}

export interface Movement {
  id_movimiento: string;
  id_usuario: string;
  id_reserva: string | null;
  tipo:
    | 'BonoInicial'
    | 'Recompensa'
    | 'Penalizacion'
    | 'Transferencia'
    | 'Ajuste'
    | 'Retencion'
    | 'Liberacion'
    | 'Consumo';
  cantidad: number;
  saldo_anterior: number;
  saldo_posterior: number;
  retenidos_anterior: number;
  retenidos_posterior: number;
  created_at: Date;
  descripcion: string | null;
}

export interface IdempotencyRecord {
  fingerprint: string;
  result: unknown;
}

/** Fila AUDITORIA de una accion administrativa; nunca incluye secretos. */
export interface AdminAuditEntry {
  id_auditoria: string;
  id_usuario: string;
  accion:
    | 'ADMIN_USER_CREATE'
    | 'ADMIN_USER_DEACTIVATE'
    | 'ADMIN_USER_REACTIVATE';
  entidad: 'USUARIOS';
  entidad_id: string;
  datos_anteriores: Record<string, unknown> | null;
  datos_nuevos: Record<string, unknown>;
  created_at: Date;
}

/** Las entidades centrales reflejan las 12 tablas oficiales optimizadas. */
export interface ExchangeState {
  users: Map<string, StoredUser>;
  availability: Map<string, Availability>;
  userSkills: Map<string, UserSkill>;
  requests: Map<string, ExchangeRequest>;
  reservations: Map<string, Reservation>;
  movements: Map<string, Movement>;
  /** Contexto de API persistido en AUDITORIA, sin columnas SQL inventadas. */
  requestMetadata: Map<string, { availabilityId: string; descripcion: string }>;
  reservationMetadata: Map<
    string,
    { availabilityId: string; administrativa: boolean }
  >;
  idempotency: Map<string, IdempotencyRecord>;
  /** Solo escritura: acciones ADMIN sobre usuarios registradas en AUDITORIA. */
  adminAudit: Map<string, AdminAuditEntry>;
}
