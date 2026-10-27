import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AvailabilityStatus } from '../../common/enums/record-status.enum';
import {
  repositoryMock,
  userFixture,
} from '../../../test/support/users.fixture';
import { UsersService } from '../users/users.service';
import { AvailabilityService } from './availability.service';
import { MemoryAvailabilityRepository } from './memory-availability.repository';

describe('AvailabilityService y atomicidad del almacenamiento', () => {
  let service: AvailabilityService;
  let repository: MemoryAvailabilityRepository;
  let usersRepository: ReturnType<typeof repositoryMock>;
  const slot = {
    fechaInicio: '2026-11-02T09:00:00-04:00',
    fechaFin: '2026-11-02T10:00:00-04:00',
  };
  beforeEach(() => {
    repository = new MemoryAvailabilityRepository();
    usersRepository = repositoryMock();
    usersRepository.findById.mockImplementation(async (id) =>
      userFixture({ id }),
    );
    service = new AvailabilityService(
      repository,
      new UsersService(usersRepository),
    );
  });
  it('crea un horario y normaliza los instantes a UTC', async () => {
    const record = await service.create('ana', slot);
    expect(record.fecha_inicio.toISOString()).toBe('2026-11-02T13:00:00.000Z');
    expect(record.id_usuario).toBe('ana');
    expect(await service.list('ana')).toHaveLength(1);
  });
  it.each([
    { fechaFin: slot.fechaInicio },
    { fechaFin: '2026-11-02T08:00:00-04:00' },
    { fechaFin: 'invalid' },
  ])('rechaza intervalos invalidos %j', async (input) => {
    await expect(service.create('ana', { ...slot, ...input })).rejects.toThrow(
      BadRequestException,
    );
  });
  it.each([
    slot,
    {
      fechaInicio: '2026-11-02T09:30:00-04:00',
      fechaFin: '2026-11-02T10:30:00-04:00',
    },
    {
      fechaInicio: '2026-11-02T08:30:00-04:00',
      fechaFin: '2026-11-02T09:30:00-04:00',
    },
    {
      fechaInicio: '2026-11-02T08:00:00-04:00',
      fechaFin: '2026-11-02T11:00:00-04:00',
    },
    {
      fechaInicio: '2026-11-02T09:15:00-04:00',
      fechaFin: '2026-11-02T09:45:00-04:00',
    },
    { fechaInicio: '2026-11-02T13:00:00Z', fechaFin: '2026-11-02T14:00:00Z' },
  ])(
    'rechaza duplicados y todas las formas de superposicion %j',
    async (input) => {
      await service.create('ana', slot);
      await expect(service.create('ana', input)).rejects.toThrow(
        ConflictException,
      );
    },
  );
  it('acepta intervalos contiguos y coincidencias de usuarios distintos', async () => {
    await service.create('ana', slot);
    await service.create('ana', {
      fechaInicio: slot.fechaFin,
      fechaFin: '2026-11-02T11:00:00-04:00',
    });
    await service.create('otro', slot);
    expect(await service.list('ana')).toHaveLength(2);
    expect(await service.list('otro')).toHaveLength(1);
  });
  it('no admite dos escrituras concurrentes superpuestas', async () => {
    const results = await Promise.allSettled([
      service.create('ana', slot),
      service.create('ana', slot),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(await service.list('ana')).toHaveLength(1);
  });
  it('conserva ambos campos al editar parcialmente el mismo horario en paralelo', async () => {
    const record = await service.create('ana', slot);
    const results = await Promise.allSettled([
      service.update('ana', record.id_disponibilidad, {
        fechaInicio: '2026-11-02T09:30:00-04:00',
      }),
      service.update('ana', record.id_disponibilidad, {
        fechaFin: '2026-11-02T11:00:00-04:00',
      }),
    ]);
    expect(results.map((result) => result.status)).toEqual([
      'fulfilled',
      'fulfilled',
    ]);
    const saved = await repository.findById(record.id_disponibilidad);
    expect(saved?.fecha_inicio.toISOString()).toBe('2026-11-02T13:30:00.000Z');
    expect(saved?.fecha_fin.toISOString()).toBe('2026-11-02T15:00:00.000Z');
  });
  it('valida el intervalo vigente si dos cambios compatibles por separado son incompatibles juntos', async () => {
    const record = await service.create('ana', slot);
    const results = await Promise.allSettled([
      service.update('ana', record.id_disponibilidad, {
        fechaInicio: '2026-11-02T09:45:00-04:00',
      }),
      service.update('ana', record.id_disponibilidad, {
        fechaFin: '2026-11-02T09:30:00-04:00',
      }),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected?.status === 'rejected' && rejected.reason).toBeInstanceOf(
      BadRequestException,
    );
    const saved = await repository.findById(record.id_disponibilidad);
    expect(saved!.fecha_fin.getTime()).toBeGreaterThan(
      saved!.fecha_inicio.getTime(),
    );
  });
  it('actualiza parcialmente y excluye el propio registro de la validacion', async () => {
    const record = await service.create('ana', slot);
    const updated = await service.update('ana', record.id_disponibilidad, {
      fechaFin: '2026-11-02T10:30:00-04:00',
    });
    expect(updated.fecha_fin.toISOString()).toBe('2026-11-02T14:30:00.000Z');
    await expect(
      service.update('ana', record.id_disponibilidad, {}),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.update('ana', record.id_disponibilidad, {
        fechaInicio: '2026-11-02T11:00:00-04:00',
      }),
    ).rejects.toThrow(BadRequestException);
  });
  it('rechaza superposicion al editar y conserva el horario original', async () => {
    const first = await service.create('ana', slot);
    await service.create('ana', {
      fechaInicio: '2026-11-02T11:00:00-04:00',
      fechaFin: '2026-11-02T12:00:00-04:00',
    });
    await expect(
      service.update('ana', first.id_disponibilidad, {
        fechaFin: '2026-11-02T11:30:00-04:00',
      }),
    ).rejects.toThrow(ConflictException);
    expect(
      (
        await repository.findById(first.id_disponibilidad)
      )?.fecha_fin.toISOString(),
    ).toBe('2026-11-02T14:00:00.000Z');
  });
  it('impide editar o desactivar registros ajenos', async () => {
    const record = await service.create('ana', slot);
    await expect(
      service.update('otro', record.id_disponibilidad, {
        fechaFin: slot.fechaFin,
      }),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.deactivate('otro', record.id_disponibilidad),
    ).rejects.toThrow(ForbiddenException);
  });
  it('desactiva sin borrar y permite reutilizar el intervalo', async () => {
    const record = await service.create('ana', slot);
    await service.deactivate('ana', record.id_disponibilidad);
    await service.deactivate('ana', record.id_disponibilidad);
    expect(await service.list('ana')).toEqual([]);
    expect((await repository.findById(record.id_disponibilidad))?.estado).toBe(
      AvailabilityStatus.CANCELADO,
    );
    await expect(
      service.update('ana', record.id_disponibilidad, {
        fechaFin: slot.fechaFin,
      }),
    ).rejects.toThrow(ConflictException);
    await service.create('ana', slot);
    expect(await service.list('ana')).toHaveLength(1);
  });
  it('devuelve 404 por horario o estudiante inexistente/inactivo', async () => {
    await expect(service.deactivate('ana', 'missing')).rejects.toThrow(
      NotFoundException,
    );
    usersRepository.findById.mockResolvedValue(userFixture({ active: false }));
    await expect(service.list('ana')).rejects.toThrow(NotFoundException);
  });
});
