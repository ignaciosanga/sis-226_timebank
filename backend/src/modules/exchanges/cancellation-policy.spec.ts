import { MemoryExchangeRepository } from './memory-exchange.repository';
import { ExchangesService } from './exchanges.service';
import { addMovement, addReservation, addUser } from './test-fixtures';
import { UsersService } from '../users/users.service';
import { SkillsService } from '../skills/skills.service';
import { Role } from '../../common/enums/role.enum';
import { DatabaseRole } from '../../common/enums/role.enum';
import { inspectIntegrity } from './integrity';
import { ReviewsService } from '../academic/reviews.service';

it('HU-08: libera una sola vez, audita motivo/anticipación y distingue replay de nueva cancelación', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2029-12-31T10:00:00Z'));
  try {
    const repository = new MemoryExchangeRepository();
    await repository.transaction((state) => addReservation(state));
    const service = new ExchangesService(
      repository,
      {
        requireActive: jest.fn().mockResolvedValue({ roles: [] }),
      } as unknown as UsersService,
      {} as SkillsService,
    );
    const first = await service.cancelReservation(
      'student',
      'r1',
      'No podré asistir',
      'cancel-academic-001',
    );
    expect(
      await service.cancelReservation(
        'student',
        'r1',
        'No podré asistir',
        'cancel-academic-001',
      ),
    ).toEqual(first);
    await expect(
      service.cancelReservation(
        'student',
        'r1',
        'No podré asistir',
        'cancel-academic-002',
      ),
    ).rejects.toThrow('ya fue cancelada');
    const result = await repository.read((s) => ({
      reservation: s.reservations.get('r1'),
      releases: [...s.movements.values()].filter(
        (m) => m.tipo === 'Liberacion',
      ),
    }));
    expect(result.releases).toHaveLength(1);
    expect(result.reservation?.horas_anticipacion_cancelacion).toBe(24);
    expect(result.reservation?.cancelado_por).toBe('student');
    expect(result.reservation?.motivo_cancelacion).toBe('No podré asistir');
  } finally {
    jest.restoreAllMocks();
  }
});

describe('HU-08: politica confirmada y decisiones pendientes', () => {
  afterEach(() => jest.restoreAllMocks());

  async function setup(actor: string, noticeMinutes: number, admin = false) {
    const now = Date.parse('2030-01-01T10:00:00Z') - noticeMinutes * 60_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const repository = new MemoryExchangeRepository();
    await repository.transaction((state) => {
      addReservation(state);
      if (admin) {
        addUser(state, actor);
        state.users.get(actor)!.rol = DatabaseRole.ADMIN;
      }
    });
    const service = new ExchangesService(
      repository,
      {
        requireActive: jest
          .fn()
          .mockResolvedValue({ roles: admin ? [Role.ADMIN] : [] }),
      } as unknown as UsersService,
      {} as SkillsService,
    );
    return {
      repository,
      service,
      cancel: (key = 'cancellation-policy-key-001') =>
        service.cancelReservation(actor, 'r1', 'Motivo HU08', key),
    };
  }

  it.each(['student', 'provider'])(
    '%s: cinco horas exactas sin multa',
    async (actor) => {
      const { repository, cancel } = await setup(actor, 300);
      const result = await cancel();
      expect(result.cancelacion).toMatchObject({
        id_usuario: actor,
        clasificacion: 'sin_multa',
        administrativa: false,
      });
      expect(await repository.read(inspectIntegrity)).toEqual([]);
      expect(
        await repository.read((state) =>
          [...state.movements.values()].filter(
            (m) => m.tipo === 'Penalizacion',
          ),
        ),
      ).toHaveLength(0);
    },
  );

  it.each(['student', 'provider'])(
    '%s: 4h59, multa unica al actor y reserva liberada al estudiante',
    async (actor) => {
      const { repository, cancel } = await setup(actor, 299);
      const first = await cancel();
      expect(first.cancelacion?.clasificacion).toBe('injustificada');
      expect(await cancel()).toEqual(first);
      const state = await repository.read((value) => value);
      expect(state.users.get('student')?.creditos_retenidos).toBe('0');
      expect(state.users.get(actor)?.saldo).toBe('39.5');
      expect(
        [...state.movements.values()].filter((m) => m.tipo === 'Penalizacion'),
      ).toMatchObject([
        { id_usuario: actor, cantidad: '-0.5', id_reserva: 'r1' },
      ]);
      expect(inspectIntegrity(state)).toEqual([]);
      const reputation = await new ReviewsService(repository).reputation({
        tutorId: 'provider',
        skillId: 'skill',
        page: 1,
        limit: 20,
      });
      expect(reputation.cancelaciones_injustificadas).toBe(
        actor === 'provider' ? 1 : 0,
      );
    },
  );

  it('cobra exactamente 0.5 disponibles sin saldo negativo', async () => {
    const { repository, cancel } = await setup('provider', 299);
    await repository.transaction((state) =>
      addMovement(state, 'adjust', 'provider', 'Ajuste', '-39.5'),
    );
    await cancel();
    expect(
      await repository.read((state) => state.users.get('provider')?.saldo),
    ).toBe('0');
    expect(await repository.read(inspectIntegrity)).toEqual([]);
  });

  it('con saldo 0.4 registra solo penalizacion_sin_saldo de 0 y no deuda', async () => {
    const { repository, cancel } = await setup('provider', 299);
    await repository.transaction((state) =>
      addMovement(state, 'adjust', 'provider', 'Ajuste', '-39.6'),
    );
    await cancel();
    const state = await repository.read((value) => value);
    expect(state.users.get('provider')?.saldo).toBe('0.4');
    expect(
      [...state.movements.values()].filter(
        (m) => m.tipo.startsWith('penalizacion') || m.tipo === 'Penalizacion',
      ),
    ).toMatchObject([{ tipo: 'penalizacion_sin_saldo', cantidad: '0' }]);
    expect(inspectIntegrity(state)).toEqual([]);
  });

  it.each(['administrator', 'student', 'provider'])(
    'ADMIN %s despues del inicio: administrativa sin multa',
    async (actor) => {
      const { repository, cancel } = await setup(actor, -60, true);
      expect((await cancel()).cancelacion).toMatchObject({
        id_usuario: actor,
        administrativa: true,
        clasificacion: 'administrativa',
      });
      expect(await repository.read(inspectIntegrity)).toEqual([]);
    },
  );

  it('un participante no puede cancelar desde el inicio', async () => {
    const { repository, cancel } = await setup('student', 0);
    const before = await repository.read((state) => structuredClone(state));
    await expect(cancel()).rejects.toThrow('requiere ADMIN');
    expect(await repository.read((state) => state)).toEqual(before);
  });

  it('no decide el saldo totalmente retenido: conflicto sin efectos hasta acuerdo BD', async () => {
    const { repository, cancel } = await setup('student', 299);
    await repository.transaction((state) =>
      addMovement(state, 'adjust', 'student', 'Ajuste', '-36'),
    );
    const before = await repository.read((state) => structuredClone(state));
    await expect(cancel()).rejects.toMatchObject({
      response: { code: 'CANCELLATION_BALANCE_POLICY_PENDING' },
    });
    expect(await repository.read((state) => state)).toEqual(before);
  });
});
