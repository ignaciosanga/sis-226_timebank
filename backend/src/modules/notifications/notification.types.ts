export const NotificationType = {
  SOLICITUD_RECIBIDA: 'SOLICITUD_RECIBIDA',
  SOLICITUD_ACEPTADA: 'SOLICITUD_ACEPTADA',
  SOLICITUD_RECHAZADA: 'SOLICITUD_RECHAZADA',
  SOLICITUD_CANCELADA: 'SOLICITUD_CANCELADA',
  RESERVA_CONFIRMADA: 'RESERVA_CONFIRMADA',
  RESERVA_CANCELADA: 'RESERVA_CANCELADA',
  RESERVA_COMPLETADA: 'RESERVA_COMPLETADA',
  OPINION_RECIBIDA: 'OPINION_RECIBIDA',
} as const;

export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];

export interface NotificationRecord {
  id_notificacion: string;
  id_usuario: string;
  tipo: NotificationType;
  titulo: string;
  mensaje: string;
  leida: boolean;
  created_at: Date;
}
