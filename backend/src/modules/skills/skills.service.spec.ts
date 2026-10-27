import { ConflictException, NotFoundException } from '@nestjs/common';
import { RecordStatus } from '../../common/enums/record-status.enum';
import { CategoriesService } from '../categories/categories.service';
import { MemoryCategoriesRepository } from '../categories/memory-categories.repository';
import { SkillsQueryDto } from './dto/skills-query.dto';
import { MemorySkillsRepository } from './memory-skills.repository';
import { SkillsService } from './skills.service';

describe('SkillsService', () => {
  let categoriesRepository: MemoryCategoriesRepository;
  let repository: MemorySkillsRepository;
  let service: SkillsService;
  const categoryId = '10000000-0000-4000-8000-000000000001';
  beforeEach(() => {
    categoriesRepository = new MemoryCategoriesRepository();
    repository = new MemorySkillsRepository();
    service = new SkillsService(
      repository,
      new CategoriesService(categoriesRepository),
    );
  });
  it('busca por nombre sin distinguir mayusculas', async () => {
    const page = await service.list(
      Object.assign(new SkillsQueryDto(), { search: 'PYTH' }),
    );
    expect(page.data.map((skill) => skill.nombre)).toEqual(['Python']);
  });
  it('combina categoria, busqueda y paginacion', async () => {
    const page = await service.list(
      Object.assign(new SkillsQueryDto(), {
        categoryId,
        search: 'p',
        limit: 1,
        page: 2,
      }),
    );
    expect(page.meta.total).toBe(2);
    expect(page.data[0]?.nombre).toBe('Python');
  });
  it('crea en categoria activa y evita duplicados incluso entre categorias', async () => {
    expect(
      (await service.create({ nombre: 'TypeScript', categoryId })).id_categoria,
    ).toBe(categoryId);
    await expect(
      service.create({
        nombre: ' python ',
        categoryId: '10000000-0000-4000-8000-000000000002',
      }),
    ).rejects.toThrow(ConflictException);
  });
  it('exige categoria existente y activa', async () => {
    await expect(
      service.create({ nombre: 'Nueva', categoryId: 'missing' }),
    ).rejects.toThrow(NotFoundException);
    jest.spyOn(categoriesRepository, 'findById').mockResolvedValue({
      id_categoria: categoryId,
      nombre: 'Tecnología',
      estado: RecordStatus.INACTIVO,
    });
    await expect(
      service.create({ nombre: 'Nueva', categoryId }),
    ).rejects.toThrow(NotFoundException);
  });
  it('no publica ni permite seleccionar habilidades inactivas', async () => {
    const record = (await repository.findAll())[0]!;
    jest
      .spyOn(repository, 'findAll')
      .mockResolvedValue([{ ...record, estado: RecordStatus.INACTIVO }]);
    jest
      .spyOn(repository, 'findById')
      .mockResolvedValue({ ...record, estado: RecordStatus.INACTIVO });
    expect((await service.list(new SkillsQueryDto())).data).toEqual([]);
    await expect(service.requireActive(record.id_habilidad)).rejects.toThrow(
      NotFoundException,
    );
  });
});
