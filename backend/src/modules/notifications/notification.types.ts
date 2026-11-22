export const NotificationType = {
  SOLICITUD_RECIBIDA: 'SolicitudRecibida',
  SOLICITUD_ACEPTADA: 'SolicitudAceptada',
  SOLICITUD_RECHAZADA: 'SolicitudRechazada',
  SOLICITUD_CANCELADA: 'SolicitudCancelada',
  RESERVA_CANCELADA: 'ReservaCancelada',
  CLASE_POR_CONFIRMAR: 'ClasePorConfirmar',
  OPINION_RECIBIDA: 'OpinionRecibida',
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
