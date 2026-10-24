import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { paginate } from '../../common/dto/list-query.dto';
import { RecordStatus } from '../../common/enums/record-status.enum';
import { nameKey } from '../../common/utils/catalog-name';
import { CategoriesService } from '../categories/categories.service';
import { CreateSkillDto } from './dto/create-skill.dto';
import { SkillsQueryDto } from './dto/skills-query.dto';
import { SKILLS_REPOSITORY, SkillsRepository } from './skills.repository';

@Injectable()
export class SkillsService {
  constructor(
    @Inject(SKILLS_REPOSITORY) private readonly repository: SkillsRepository,
    private readonly categories: CategoriesService,
  ) {}
  async list(query: SkillsQueryDto) {
    const records = (await this.repository.findAll()).filter(
      (record) =>
        record.estado === RecordStatus.ACTIVO &&
        (!query.search ||
          nameKey(record.nombre).includes(nameKey(query.search))) &&
        (!query.categoryId || record.id_categoria === query.categoryId),
    );
    return paginate(records, query);
  }
  async requireActive(id: string) {
    const skill = await this.repository.findById(id);
    if (!skill || skill.estado !== RecordStatus.ACTIVO)
      throw new NotFoundException('Habilidad activa no encontrada');
    await this.categories.requireActive(skill.id_categoria);
    return skill;
  }
  async create(input: CreateSkillDto) {
    await this.categories.requireActive(input.categoryId);
    return this.repository.create(input.nombre, input.categoryId);
  }
}
