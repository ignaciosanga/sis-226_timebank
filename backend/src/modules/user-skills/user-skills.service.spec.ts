import { ConflictException, NotFoundException } from '@nestjs/common';
import { RecordStatus } from '../../common/enums/record-status.enum';
import {
  repositoryMock,
  userFixture,
} from '../../../test/support/users.fixture';
import { CategoriesService } from '../categories/categories.service';
import { MemoryCategoriesRepository } from '../categories/memory-categories.repository';
import { MemorySkillsRepository } from '../skills/memory-skills.repository';
import { SkillsService } from '../skills/skills.service';
import { UsersService } from '../users/users.service';
import { MemoryUserSkillsRepository } from './memory-user-skills.repository';
import { SkillLevel } from './user-skill.types';
import { UserSkillsService } from './user-skills.service';

describe('UserSkillsService', () => {
  let service: UserSkillsService;
  let skillsRepository: MemorySkillsRepository;
  let usersRepository: ReturnType<typeof repositoryMock>;
  const skillId = '20000000-0000-4000-8000-000000000002';
  const input = { skillId, nivel: SkillLevel.INTERMEDIO };
  beforeEach(() => {
    usersRepository = repositoryMock();
    usersRepository.findById.mockImplementation(async (id) =>
      userFixture({ id }),
    );
    skillsRepository = new MemorySkillsRepository();
    service = new UserSkillsService(
      new MemoryUserSkillsRepository(),
      new SkillsService(
        skillsRepository,
        new CategoriesService(new MemoryCategoriesRepository()),
      ),
      new UsersService(usersRepository),
    );
  });
  it('registra identidad autenticada y consulta el catalogo compartido', async () => {
    const created = await service.add(
      'ana',
      Object.assign({}, input, { id_usuario: 'otro' }),
    );
    expect(created.id_usuario).toBe('ana');
    expect((await service.list('ana'))[0]?.habilidad.nombre).toBe('Python');
  });
  it('rechaza duplicados atomicos y habilidades inexistentes', async () => {
    await service.add('ana', input);
    await expect(service.add('ana', input)).rejects.toThrow(ConflictException);
    await expect(
      service.add('ana', { ...input, skillId: 'missing' }),
    ).rejects.toThrow(NotFoundException);
  });
  it('rechaza habilidades inactivas y las oculta al consultar', async () => {
    await service.add('ana', input);
    jest.spyOn(skillsRepository, 'findById').mockResolvedValue({
      id_habilidad: skillId,
      nombre: 'Python',
      id_categoria: '10000000-0000-4000-8000-000000000001',
      estado: RecordStatus.INACTIVO,
    });
    await expect(service.add('otro', input)).rejects.toThrow(NotFoundException);
    expect(await service.list('ana')).toEqual([]);
  });
  it('solo elimina la relacion del usuario autenticado', async () => {
    await service.add('ana', input);
    await expect(service.remove('otro', skillId)).rejects.toThrow(
      NotFoundException,
    );
    expect(await service.list('ana')).toHaveLength(1);
    await service.remove('ana', skillId);
    expect(await service.list('ana')).toEqual([]);
    await service.add('ana', input);
    expect(await service.list('ana')).toHaveLength(1);
  });
  it('no publica estudiantes inexistentes o suspendidos', async () => {
    usersRepository.findById.mockResolvedValue(userFixture({ active: false }));
    await expect(service.list('ana')).rejects.toThrow(NotFoundException);
    usersRepository.findById.mockResolvedValue(null);
    await expect(service.list('ana')).rejects.toThrow(NotFoundException);
  });
});
