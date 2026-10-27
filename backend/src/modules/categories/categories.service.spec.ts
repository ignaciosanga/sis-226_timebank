import { ConflictException, NotFoundException } from '@nestjs/common';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { RecordStatus } from '../../common/enums/record-status.enum';
import { CategoriesService } from './categories.service';
import { MemoryCategoriesRepository } from './memory-categories.repository';

describe('CategoriesService y persistencia memoria', () => {
  let repository: MemoryCategoriesRepository;
  let service: CategoriesService;
  beforeEach(() => {
    repository = new MemoryCategoriesRepository();
    service = new CategoriesService(repository);
  });
  it('lista las cuatro categorias con contrato paginado y filtros', async () => {
    const first = await service.list(
      Object.assign(new ListQueryDto(), { limit: 2 }),
    );
    expect(first.data).toHaveLength(2);
    expect(first.meta).toEqual({ page: 1, limit: 2, total: 4, totalPages: 2 });
    expect(
      (
        await service.list(
          Object.assign(new ListQueryDto(), { search: 'IDIOMAS' }),
        )
      ).data[0]?.nombre,
    ).toBe('Idiomas');
  });
  it('rechaza duplicados normalizados y concurrentes', async () => {
    await expect(service.create({ nombre: '  TECNOLOGÍA  ' })).rejects.toThrow(
      ConflictException,
    );
    const results = await Promise.allSettled([
      service.create({ nombre: 'Ciencias' }),
      service.create({ nombre: 'ciencias' }),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
  });
  it('omite inactivas y devuelve 404 por inexistente o inactiva', async () => {
    const category = (await repository.findAll())[0]!;
    jest
      .spyOn(repository, 'findAll')
      .mockResolvedValue([{ ...category, estado: RecordStatus.INACTIVO }]);
    jest
      .spyOn(repository, 'findById')
      .mockResolvedValue({ ...category, estado: RecordStatus.INACTIVO });
    expect((await service.list(new ListQueryDto())).data).toEqual([]);
    await expect(service.requireActive(category.id_categoria)).rejects.toThrow(
      NotFoundException,
    );
    jest.mocked(repository.findById).mockResolvedValue(null);
    await expect(service.requireActive('missing')).rejects.toThrow(
      NotFoundException,
    );
  });
  it('las lecturas no permiten modificar el almacenamiento indirectamente', async () => {
    const category = (await repository.findAll())[0]!;
    category.nombre = 'Mutado';
    expect((await repository.findById(category.id_categoria))?.nombre).toBe(
      'Tecnología',
    );
  });
});
