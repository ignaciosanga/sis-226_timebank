import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ListQueryDto, paginate } from '../../common/dto/list-query.dto';
import { RecordStatus } from '../../common/enums/record-status.enum';
import { nameKey } from '../../common/utils/catalog-name';
import {
  CATEGORIES_REPOSITORY,
  CategoriesRepository,
} from './categories.repository';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @Inject(CATEGORIES_REPOSITORY)
    private readonly repository: CategoriesRepository,
  ) {}

  async list(query: ListQueryDto) {
    const records = (await this.repository.findAll()).filter(
      (record) =>
        record.estado === RecordStatus.ACTIVO &&
        (!query.search ||
          nameKey(record.nombre).includes(nameKey(query.search))),
    );
    return paginate(records, query);
  }
  async requireActive(id: string) {
    const record = await this.repository.findById(id);
    if (!record || record.estado !== RecordStatus.ACTIVO)
      throw new NotFoundException('Categoria activa no encontrada');
    return record;
  }
  create(input: CreateCategoryDto) {
    return this.repository.create(input.nombre);
  }
}
