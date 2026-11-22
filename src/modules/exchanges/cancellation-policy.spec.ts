import { MemoryExchangeRepository } from './memory-exchange.repository';
import { ExchangesService } from './exchanges.service';
import { addReservation } from './test-fixtures';
import { UsersService } from '../users/users.service';
import { SkillsService } from '../skills/skills.service';

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
