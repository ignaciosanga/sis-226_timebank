import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  EXCHANGE_REPOSITORY,
  ExchangeRepository,
} from '../exchanges/exchange.repository';
import { addNotification } from './notification.factory';
import { NotificationRecord, NotificationType } from './notification.types';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(EXCHANGE_REPOSITORY)
    private readonly persistence: ExchangeRepository,
  ) {}

  listForUser(userId: string): Promise<NotificationRecord[]> {
    return this.persistence.read((state) =>
      [...state.notifications.values()]
        .filter((notification) => notification.id_usuario === userId)
        .sort(
          (left, right) =>
            right.created_at.getTime() - left.created_at.getTime() ||
            right.id_notificacion.localeCompare(left.id_notificacion),
        ),
    );
  }

  markRead(
    userId: string,
    notificationId: string,
  ): Promise<NotificationRecord> {
    return this.persistence.transaction((state) => {
      const notification = state.notifications.get(notificationId);
      if (!notification || notification.id_usuario !== userId)
        throw new NotFoundException('Notificacion no encontrada');
      notification.leida = true;
      return notification;
    });
  }

  markAllRead(userId: string): Promise<{ actualizadas: number }> {
    return this.persistence.transaction((state) => {
      let actualizadas = 0;
      for (const notification of state.notifications.values()) {
        if (notification.id_usuario === userId && !notification.leida) {
          notification.leida = true;
          actualizadas++;
        }
      }
      return { actualizadas };
    });
  }

  notifyOpinionReceived(
    recipientId: string,
    ratingId: string,
  ): Promise<NotificationRecord> {
    return this.persistence.transaction((state) => {
      if (!state.users.has(recipientId))
        throw new NotFoundException('Usuario no encontrado');
      return addNotification(state, {
        eventId: `opinion:${ratingId}`,
        recipientId,
        type: NotificationType.OPINION_RECIBIDA,
        title: 'Recibiste una nueva opinión',
        message: 'Un estudiante dejó una opinión sobre un intercambio contigo.',
      });
    });
  }
}
