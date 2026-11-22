import { NotFoundException } from '@nestjs/common';
import { MemoryExchangeRepository } from '../exchanges/memory-exchange.repository';
import { storedUser } from '../exchanges/test-fixtures';
import { addNotification } from './notification.factory';
import { NotificationsService } from './notifications.service';
import { NotificationType } from './notification.types';

describe('NotificationsService', () => {
  let repository: MemoryExchangeRepository;
  let service: NotificationsService;

  beforeEach(() => {
    repository = new MemoryExchangeRepository();
    service = new NotificationsService(repository);
  });

  it('lists only the signed-in user notifications, newest first', async () => {
    const older = new Date('2030-01-01T10:00:00Z');
    const newer = new Date('2030-01-01T11:00:00Z');
    await repository.transaction((state) => {
      state.users.set('student-a', storedUser('student-a'));
      state.users.set('student-b', storedUser('student-b'));
      addNotification(state, {
        eventId: 'older',
        recipientId: 'student-a',
        type: NotificationType.SOLICITUD_RECIBIDA,
        title: 'Anterior',
        message: 'Mensaje anterior',
        createdAt: older,
      });
      addNotification(state, {
        eventId: 'newer',
        recipientId: 'student-a',
        type: NotificationType.RESERVA_CONFIRMADA,
        title: 'Reciente',
        message: 'Mensaje reciente',
        createdAt: newer,
      });
      addNotification(state, {
        eventId: 'other-user',
        recipientId: 'student-b',
        type: NotificationType.OPINION_RECIBIDA,
        title: 'Privada',
        message: 'Notificación ajena',
      });
    });

    const notifications = await service.listForUser('student-a');

    expect(notifications.map(({ titulo }) => titulo)).toEqual([
      'Reciente',
      'Anterior',
    ]);
    expect(notifications.every(({ id_usuario }) => id_usuario === 'student-a'))
      .toBe(true);
  });

  it('marks one notification read and hides notifications belonging to others', async () => {
    let notificationId = '';
    await repository.transaction((state) => {
      state.users.set('student-a', storedUser('student-a'));
      state.users.set('student-b', storedUser('student-b'));
      notificationId = addNotification(state, {
        eventId: 'private-event',
        recipientId: 'student-a',
        type: NotificationType.SOLICITUD_RECIBIDA,
        title: 'Solicitud',
        message: 'Nueva solicitud',
      }).id_notificacion;
    });

    const read = await service.markRead('student-a', notificationId);
    expect(read.leida).toBe(true);
    await expect(service.markRead('student-b', notificationId)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('marks all and only the current user unread notifications', async () => {
    await repository.transaction((state) => {
      state.users.set('student-a', storedUser('student-a'));
      state.users.set('student-b', storedUser('student-b'));
      addNotification(state, {
        eventId: 'a-unread',
        recipientId: 'student-a',
        type: NotificationType.SOLICITUD_RECIBIDA,
        title: 'Pendiente',
        message: 'Pendiente',
      });
      const alreadyRead = addNotification(state, {
        eventId: 'a-read',
        recipientId: 'student-a',
        type: NotificationType.RESERVA_CONFIRMADA,
        title: 'Leída',
        message: 'Leída',
      });
      alreadyRead.leida = true;
      addNotification(state, {
        eventId: 'b-unread',
        recipientId: 'student-b',
        type: NotificationType.OPINION_RECIBIDA,
        title: 'Ajena',
        message: 'Ajena',
      });
    });

    await expect(service.markAllRead('student-a')).resolves.toEqual({
      actualizadas: 1,
    });
    const [mine, other] = await Promise.all([
      service.listForUser('student-a'),
      service.listForUser('student-b'),
    ]);
    expect(mine.every(({ leida }) => leida)).toBe(true);
    expect(other[0]?.leida).toBe(false);
  });

  it('creates a single notification when an opinion event is retried', async () => {
    await repository.transaction((state) => {
      state.users.set('student-a', storedUser('student-a'));
    });

    const first = await service.notifyOpinionReceived('student-a', 'rating-1');
    const retry = await service.notifyOpinionReceived('student-a', 'rating-1');

    expect(retry.id_notificacion).toBe(first.id_notificacion);
    expect(retry.tipo).toBe(NotificationType.OPINION_RECIBIDA);
    expect(await service.listForUser('student-a')).toHaveLength(1);
  });
});
