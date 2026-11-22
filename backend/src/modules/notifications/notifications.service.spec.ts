import { NotFoundException } from '@nestjs/common';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { MemoryExchangeRepository } from '../exchanges/memory-exchange.repository';
import { storedUser } from '../exchanges/test-fixtures';
import { addNotification } from './notification.factory';
import { NotificationsService } from './notifications.service';
import { NotificationType } from './notification.types';

const listQuery = (page = 1, limit = 20) =>
  Object.assign(new ListQueryDto(), { page, limit });

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
        type: NotificationType.SOLICITUD_ACEPTADA,
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

    const notifications = await service.listForUser('student-a', listQuery());

    expect(notifications.data.map(({ titulo }) => titulo)).toEqual([
      'Reciente',
      'Anterior',
    ]);
    expect(
      notifications.data.every(({ id_usuario }) => id_usuario === 'student-a'),
    ).toBe(true);
    expect(notifications.meta).toEqual({
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
      noLeidas: 2,
    });
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
        type: NotificationType.SOLICITUD_ACEPTADA,
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

    const firstPage = await service.listForUser('student-a', listQuery(1, 1));
    expect(firstPage.data).toHaveLength(1);
    expect(firstPage.meta).toEqual({
      page: 1,
      limit: 1,
      total: 2,
      totalPages: 2,
      noLeidas: 1,
    });

    await expect(service.markAllRead('student-a')).resolves.toEqual({
      actualizadas: 1,
    });
    const [mine, other] = await Promise.all([
      service.listForUser('student-a', listQuery()),
      service.listForUser('student-b', listQuery()),
    ]);
    expect(mine.data.every(({ leida }) => leida)).toBe(true);
    expect(other.data[0]?.leida).toBe(false);
  });

});
