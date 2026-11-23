import { createHash } from 'node:crypto';
import type { ExchangeState } from '../exchanges/exchange.types';
import type {
  NotificationRecord,
  NotificationType,
} from './notification.types';

function notificationId(eventId: string, recipientId: string): string {
  const bytes = Buffer.from(
    createHash('sha256')
      .update(`timebank:notification:${eventId}:${recipientId}`)
      .digest('hex')
      .slice(0, 32),
    'hex',
  );
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function addNotification(
  state: ExchangeState,
  input: {
    eventId: string;
    recipientId: string;
    type: NotificationType;
    title: string;
    message: string;
    createdAt?: Date;
  },
): NotificationRecord {
  const id_notificacion = notificationId(input.eventId, input.recipientId);
  const existing = state.notifications.get(id_notificacion);
  if (existing) return existing;

  const notification: NotificationRecord = {
    id_notificacion,
    id_usuario: input.recipientId,
    tipo: input.type,
    titulo: input.title,
    mensaje: input.message,
    leida: false,
    created_at: input.createdAt ?? new Date(),
  };
  state.notifications.set(id_notificacion, notification);
  return notification;
}
