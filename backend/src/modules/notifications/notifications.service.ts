import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ListQueryDto, paginate } from '../../common/dto/list-query.dto';
import {
  EXCHANGE_REPOSITORY,
  ExchangeRepository,
} from '../exchanges/exchange.repository';
import { NotificationRecord } from './notification.types';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(EXCHANGE_REPOSITORY)
    private readonly persistence: ExchangeRepository,
  ) {}

  listForUser(userId: string, query: ListQueryDto) {
    return this.persistence.read((state) => {
      const ownNotifications = [...state.notifications.values()]
        .filter((notification) => notification.id_usuario === userId)
        .sort(
          (left, right) =>
            right.created_at.getTime() - left.created_at.getTime() ||
            right.id_notificacion.localeCompare(left.id_notificacion),
        );
      const page = paginate(ownNotifications, query);
      return {
        ...page,
        meta: {
          ...page.meta,
          noLeidas: ownNotifications.filter(({ leida }) => !leida).length,
        },
      };
    });
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
}
