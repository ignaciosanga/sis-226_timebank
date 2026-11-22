import { validate } from 'class-validator';
import curriculum from './curriculum.json';
import { academicPeriod } from './academic.repository';
import { AcademicPeriodDto, ReviewDto, RoadmapUpdateDto } from './academic.dto';
import { ReviewsService } from './reviews.service';
import { MemoryExchangeRepository } from '../exchanges/memory-exchange.repository';
import { addReservation } from '../exchanges/test-fixtures';
import { ReservationStatus } from '../exchanges/exchange.types';
import { NotificationType } from '../notifications/notification.types';

describe('Contrato académico y opiniones', () => {
  let repository: MemoryExchangeRepository;
  let reviews: ReviewsService;
  beforeEach(async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2030, 0, 2));
    repository = new MemoryExchangeRepository();
    reviews = new ReviewsService(repository);
    await repository.transaction((state) =>
      addReservation(state, { status: ReservationStatus.COMPLETADA }),
    );
  });
  afterEach(() => jest.restoreAllMocks());

  it('contiene 49 materias, un requisito externo y referencias únicas resolubles', () => {
    const codes = new Set(curriculum.courses.map((c) => c.codigo));
    expect(curriculum.courses.filter((c) => !c.externo)).toHaveLength(49);
    expect(codes.size).toBe(50);
    expect([...codes]).not.toContain('LIBRE-I');
    expect([...codes]).not.toContain('LIBRE-II');
    expect(
      curriculum.courses.filter((c) => c.externo).map((c) => c.codigo),
    ).toEqual(['MAT-030']);
    for (const course of curriculum.courses)
      for (const prerequisite of course.requisitos)
        expect(codes.has(prerequisite)).toBe(true);
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const visit = (code: string) => {
      expect(visiting.has(code)).toBe(false);
      if (visited.has(code)) return;
      visiting.add(code);
      for (const required of curriculum.courses.find((c) => c.codigo === code)!
        .requisitos)
        visit(required);
      visiting.delete(code);
      visited.add(code);
    };
    for (const code of codes) visit(code);
  });

  it('concurrencia y replay crean una sola opinión sin alterar saldos', async () => {
    const before = await repository.read((s) => [...s.users.values()]);
    const input = { calificacion: 5, comentario: 'Útil' };
    const results = await Promise.all([
      reviews.create('student', 'r1', input, 'review-replay-001'),
      reviews.create('student', 'r1', input, 'review-replay-001'),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(await repository.read((s) => s.ratings.size)).toBe(1);
    const notifications = await repository.read((s) => [
      ...s.notifications.values(),
    ]);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      id_usuario: 'provider',
      tipo: NotificationType.OPINION_RECIBIDA,
    });
    expect(await repository.read((s) => [...s.users.values()])).toEqual(before);
    await expect(
      reviews.create('student', 'r1', input, 'another-key-00001'),
    ).rejects.toThrow('ya tiene');
    await expect(
      reviews.create(
        'student',
        'r1',
        { ...input, calificacion: 4 },
        'review-replay-001',
      ),
    ).rejects.toThrow('otro contenido');
  });

  it('rechaza tutor, tercero, cancelada y clase futura', async () => {
    const input = { calificacion: 5, comentario: '' };
    for (const actor of ['provider', 'stranger'])
      await expect(
        reviews.create(actor, 'r1', input, 'review-negative-1'),
      ).rejects.toThrow('Solo quien');
    await repository.transaction((s) => {
      s.reservations.get('r1')!.estado = ReservationStatus.CANCELADA;
    });
    await expect(
      reviews.create('student', 'r1', input, 'review-negative-1'),
    ).rejects.toThrow('completada');
    await repository.transaction((s) => {
      s.reservations.get('r1')!.estado = ReservationStatus.COMPLETADA;
      s.reservations.get('r1')!.fecha_fin = new Date('2031-01-01');
    });
    await expect(
      reviews.create('student', 'r1', input, 'review-negative-1'),
    ).rejects.toThrow('finalizado');
  });

  it('sin opiniones usa null; otras materias y otros autores no se mezclan', async () => {
    const filter = {
      tutorId: 'provider',
      skillId: 'skill',
      page: 1,
      limit: 20,
    };
    expect((await reviews.reputation(filter)).promedio).toBeNull();
    await reviews.create(
      'student',
      'r1',
      { calificacion: 4, comentario: '' },
      'review-positive1',
    );
    expect((await reviews.reputation(filter)).promedio).toBe(4);
    expect(
      (await reviews.reputation({ ...filter, skillId: 'other' })).promedio,
    ).toBeNull();
    expect((await reviews.list(filter, 'provider')).data).toEqual([]);
    expect(
      (await reviews.list({ ...filter, page: 2 }, 'student')).data,
    ).toEqual([]);
  });

  it('valida estados, puntuaciones, longitud y fechas con zona', async () => {
    for (const calificacion of [0, 6, 1.5, '5', null])
      expect(
        await validate(Object.assign(new ReviewDto(), { calificacion })),
      ).not.toHaveLength(0);
    expect(
      await validate(
        Object.assign(new ReviewDto(), {
          calificacion: 4,
          comentario: 'x'.repeat(501),
        }),
      ),
    ).not.toHaveLength(0);
    expect(
      await validate(
        Object.assign(new RoadmapUpdateDto(), { estado: 'recommended' }),
      ),
    ).not.toHaveLength(0);
    expect(
      await validate(
        Object.assign(new AcademicPeriodDto(), { from: '2026-11-20T00:00:00' }),
      ),
    ).not.toHaveLength(0);
    expect(
      academicPeriod({
        from: '2026-11-20T00:00:00-04:00',
        to: '2026-11-21T00:00:00-04:00',
      }).from.toISOString(),
    ).toBe('2026-11-20T04:00:00.000Z');
    expect(() =>
      academicPeriod({
        from: '2026-11-21T00:00:00Z',
        to: '2026-11-20T00:00:00Z',
      }),
    ).toThrow();
  });
});
