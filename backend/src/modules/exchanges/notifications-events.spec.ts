import { AvailabilityStatus } from '../../common/enums/record-status.enum';
import { Role } from '../../common/enums/role.enum';
import { Availability } from '../availability/availability.types';
import { UsersService } from '../users/users.service';
import { SkillsService } from '../skills/skills.service';
import { SkillLevel } from '../user-skills/user-skill.types';
import { MemoryExchangeRepository } from './memory-exchange.repository';
import { ExchangesService } from './exchanges.service';
import { addUser } from './test-fixtures';
import { NotificationType } from '../notifications/notification.types';

async function setupExchange() {
  const repository = new MemoryExchangeRepository();
  const start = new Date(Date.now() + 60 * 60 * 1_000);
  start.setSeconds(0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1_000);
  await repository.transaction((state) => {
    addUser(state, 'requester');
    addUser(state, 'provider');
    state.availability.set('slot-provider', {
      id_disponibilidad: 'slot-provider',
      id_usuario: 'provider',
      fecha_inicio: new Date(start.getTime() - 60 * 60 * 1_000),
      fecha_fin: new Date(end.getTime() + 60 * 60 * 1_000),
      estado: AvailabilityStatus.DISPONIBLE,
    } satisfies Availability);
    state.userSkills.set('provider:python', {
      id_usuario: 'provider',
      id_habilidad: 'python',
      nivel: SkillLevel.AVANZADO,
    });
  });
  const users = {
    requireActive: jest.fn(async (id: string) => ({
      id,
      roles: [Role.ESTUDIANTE],
    })),
    requirePublishedStudent: jest.fn(async () => undefined),
  };
  const skills = {
    requireActive: jest.fn(async () => ({
      id_habilidad: 'python',
      nombre: 'Python',
    })),
  };
  const service = new ExchangesService(
    repository,
    users as unknown as UsersService,
    skills as unknown as SkillsService,
  );
  const createRequest = (suffix = 'first') =>
    service.createRequest(
      'requester',
      {
        providerId: 'provider',
        skillId: 'python',
        availabilityId: 'slot-provider',
        fechaInicio: start.toISOString(),
        fechaFin: end.toISOString(),
        descripcion: 'Ayuda con funciones',
      },
      `request-create-${suffix}-key`,
    );
  return { repository, service, createRequest, start, end };
}

describe('notificaciones de solicitudes y reservas', () => {
  afterEach(() => jest.useRealTimers());

  it('notifies the provider once when a request is created, including an idempotent retry', async () => {
    const { repository, createRequest } = await setupExchange();

    const request = await createRequest();
    await createRequest();

    const notifications = await repository.read((state) => [
      ...state.notifications.values(),
    ]);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      id_usuario: 'provider',
      tipo: NotificationType.SOLICITUD_RECIBIDA,
      mensaje: 'requester Prueba quiere aprender Python.',
    });
    expect(request.estado).toBe('Solicitada');
  });

  it('notifies the requester after acceptance and the provider after rejection or request cancellation', async () => {
    const accepted = await setupExchange();
    const acceptedRequest = await accepted.createRequest('accepted');
    await accepted.service.acceptRequest(
      'provider',
      acceptedRequest.id_solicitud,
      'accept-request-0001',
    );
    const afterAccept = await accepted.repository.read((state) => [
      ...state.notifications.values(),
    ]);
    expect(afterAccept).toHaveLength(2);
    expect(afterAccept).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id_usuario: 'requester',
          tipo: NotificationType.SOLICITUD_ACEPTADA,
        }),
      ]),
    );

    const rejected = await setupExchange();
    const rejectedRequest = await rejected.createRequest('rejected');
    await rejected.service.rejectRequest(
      'provider',
      rejectedRequest.id_solicitud,
      'reject-request-0001',
    );
    const rejectedNotifications = await rejected.repository.read((state) => [
      ...state.notifications.values(),
    ]);
    expect(rejectedNotifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id_usuario: 'requester',
          tipo: NotificationType.SOLICITUD_RECHAZADA,
        }),
      ]),
    );

    const cancelled = await setupExchange();
    const cancelledRequest = await cancelled.createRequest('cancelled');
    await cancelled.service.cancelRequest(
      'requester',
      cancelledRequest.id_solicitud,
      'cancel-request-0001',
    );
    const cancelledNotifications = await cancelled.repository.read((state) => [
      ...state.notifications.values(),
    ]);
    expect(cancelledNotifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id_usuario: 'provider',
          tipo: NotificationType.SOLICITUD_CANCELADA,
        }),
      ]),
    );
  });

  it('notifies the other participant when a reservation is cancelled or completed', async () => {
    const cancelled = await setupExchange();
    const request = await cancelled.createRequest('cancel-reservation');
    const reservation = await cancelled.service.acceptRequest(
      'provider',
      request.id_solicitud,
      'accept-cancel-0001',
    );
    await cancelled.service.cancelReservation(
      'requester',
      reservation.id_reserva,
      'Cambio de horario',
      'cancel-reservation-0001',
    );
    const cancelledNotifications = await cancelled.repository.read((state) => [
      ...state.notifications.values(),
    ]);
    expect(cancelledNotifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id_usuario: 'provider',
          tipo: NotificationType.RESERVA_CANCELADA,
          mensaje: expect.stringContaining('Cambio de horario'),
        }),
      ]),
    );

    jest.useFakeTimers().setSystemTime(new Date('2030-01-01T08:00:00Z'));
    const completed = await setupExchange();
    const completionRequest = await completed.createRequest('complete');
    const completionReservation = await completed.service.acceptRequest(
      'provider',
      completionRequest.id_solicitud,
      'accept-complete-0001',
    );
    jest.setSystemTime(completed.end.getTime() + 60_000);
    await completed.service.confirmReservation(
      'requester',
      completionReservation.id_reserva,
      'confirm-requester-0001',
    );
    await completed.service.confirmReservation(
      'provider',
      completionReservation.id_reserva,
      'confirm-provider-0001',
    );
    const completedNotifications = await completed.repository.read((state) => [
      ...state.notifications.values(),
    ]);
    expect(completedNotifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id_usuario: 'requester',
          tipo: NotificationType.RESERVA_COMPLETADA,
        }),
      ]),
    );
  });
});
