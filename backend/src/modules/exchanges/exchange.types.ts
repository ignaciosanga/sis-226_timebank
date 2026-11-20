import type { Availability } from '../availability/availability.types';
import type { UserSkill } from '../user-skills/user-skill.types';
import type { StoredUser } from '../users/user.types';
import type { TutoringOffer } from '../tutoring/offer.types';
import type { TutoringBanner } from '../tutoring/banners/banner.types';
import type { OfferRating } from '../tutoring/offer-metrics';
import type { CreditValue } from './credits';

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
  id_oferta?: string | null;
  id_solicitud: string;
  id_solicitante: string;
  id_ofertante: string;
  id_habilidad: string;
  fecha_inicio_propuesta: Date;
  fecha_fin_propuesta: Date;
  creditos_requeridos: CreditValue;
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
  creditos: CreditValue;
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
  cantidad: CreditValue;
  saldo_anterior: CreditValue;
  saldo_posterior: CreditValue;
  retenidos_anterior: CreditValue;
  retenidos_posterior: CreditValue;
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
    'ADMIN_USER_CREATE' | 'ADMIN_USER_DEACTIVATE' | 'ADMIN_USER_REACTIVATE';
  entidad: 'USUARIOS';
  entidad_id: string;
  datos_anteriores: Record<string, unknown> | null;
  datos_nuevos: Record<string, unknown>;
  created_at: Date;
}

/** Las entidades centrales reflejan las 12 tablas oficiales optimizadas. */
export interface ExchangeState {
  /** Capacidad verificada del esquema; no es una bandera configurable por HTTP. */
  creditSchema: 'integer' | 'decimal';
  offers: Map<string, TutoringOffer>;
  banners: Map<string, TutoringBanner>;
  /** Lectura de calificaciones existentes; fase 3 no escribe reseñas. */
  ratings: Map<string, OfferRating>;
  verifications: Map<string, EmailVerification>;
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

export interface EmailVerification {
  id_verificacion: string;
  id_usuario: string;
  token_hash: string;
  created_at: Date;
  expires_at: Date;
  consumed_at: Date | null;
}
