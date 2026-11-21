import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { MemoryExchangeRepository } from '../exchanges/memory-exchange.repository';
import { storedUser } from '../exchanges/test-fixtures';
import { SkillsService } from '../skills/skills.service';
import { SkillLevel } from '../user-skills/user-skill.types';
import { TutoringBannerService } from './banners/banner.service';
import { TutoringService } from './tutoring.service';
import { OffersQueryDto } from './dto/offers-query.dto';
import { RequestStatus } from '../exchanges/exchange.types';

describe('HU-05 edición, detalle y filtros de ofertas', () => {
  let repository: MemoryExchangeRepository;
  let service: TutoringService;
  const actor = randomUUID();
  const skillId = randomUUID();
  const input = {
    skillId,
    nivel: SkillLevel.INTERMEDIO,
    titulo: 'Clase',
    descripcion: 'Programación',
    costoCreditos: '3.7',
    fechaInicio: '2035-01-01T10:00:00Z',
    fechaFin: '2035-01-01T11:00:00Z',
  };
  beforeEach(async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2034-12-01T00:00:00Z'));
    repository = new MemoryExchangeRepository();
    service = new TutoringService(
      repository,
      {
        requireActive: jest
          .fn()
          .mockResolvedValue({ id_habilidad: skillId, nombre: 'Programación' }),
        academicCodes: jest
          .fn()
          .mockResolvedValue(new Map([[skillId, 'SIS-111']])),
      } as unknown as SkillsService,
      {
        validateAndAttach: jest.fn().mockResolvedValue(null),
      } as unknown as TutoringBannerService,
      new ConfigService({ PUBLIC_API_URL: 'http://localhost:4000' }),
    );
    await repository.transaction((s) => {
      s.users.set(actor, storedUser(actor));
      s.userSkills.set(`${actor}:${skillId}`, {
        id_usuario: actor,
        id_habilidad: skillId,
        nivel: SkillLevel.INTERMEDIO,
      });
    });
  });
  afterEach(() => jest.restoreAllMocks());

  async function publishedId(): Promise<string> {
    const result = (await service.publish(actor, input, randomUUID())) as {
      id_oferta: string;
    };
    return result.id_oferta;
  }

  it('ofrece detalle y búsqueda por código y otros tutores', async () => {
    const id = await publishedId();
    expect((await service.detail(id)).materia.codigo).toBe('SIS-111');
    expect(
      (
        await service.list(
          Object.assign(new OffersQueryDto(), { search: 'SIS-111' }),
        )
      ).meta.total,
    ).toBe(1);
    expect(
      (
        await service.list(
          Object.assign(new OffersQueryDto(), { codigo: 'SIS-112' }),
        )
      ).meta.total,
    ).toBe(0);
    expect(
      (
        await service.list(
          Object.assign(new OffersQueryDto(), { excludeTutorId: actor }),
        )
      ).meta.total,
    ).toBe(0);
  });

  it('edita con replay sin cambiar snapshot pactado ni saldos; bloquea horario solicitado', async () => {
    const id = await publishedId();
    await repository.transaction((s) => {
      s.requests.set('request', {
        id_solicitud: 'request',
        id_oferta: id,
        id_solicitante: 'learner',
        id_ofertante: actor,
        id_habilidad: skillId,
        fecha_inicio_propuesta: new Date(input.fechaInicio),
        fecha_fin_propuesta: new Date(input.fechaFin),
        creditos_requeridos: '3.7',
        estado: RequestStatus.PENDIENTE,
        created_at: new Date(),
        respondida_at: null,
      });
    });
    const before = await repository.read((s) => [...s.users.values()]);
    const key = randomUUID();
    const patch = { ...input, costoCreditos: '8', titulo: 'Nuevo título' };
    const first = await service.update(actor, id, patch, key);
    expect(await service.update(actor, id, patch, key)).toEqual(first);
    expect(
      await repository.read(
        (s) => s.requests.get('request')!.creditos_requeridos,
      ),
    ).toBe('3.7');
    expect(await repository.read((s) => [...s.users.values()])).toEqual(before);
    await expect(
      service.update(
        actor,
        id,
        {
          ...patch,
          fechaInicio: '2035-01-01T12:00:00Z',
          fechaFin: '2035-01-01T13:00:00Z',
        },
        randomUUID(),
      ),
    ).rejects.toThrow('horario');
    await expect(
      service.update('stranger', id, input, randomUUID()),
    ).rejects.toThrow('propietario');
    await expect(service.update(actor, id, input, key)).rejects.toThrow(
      'otro contenido',
    );
  });
});
