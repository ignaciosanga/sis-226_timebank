import { ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RecordStatus } from '../../common/enums/record-status.enum';
import { nameKey, normalizeName } from '../../common/utils/catalog-name';
import { Skill } from './skill.types';
import { SkillsRepository } from './skills.repository';

const seed: Skill[] = [
  [
    '20000000-0000-4000-8000-000000000001',
    'Programación Java',
    '10000000-0000-4000-8000-000000000001',
  ],
  [
    '20000000-0000-4000-8000-000000000002',
    'Python',
    '10000000-0000-4000-8000-000000000001',
  ],
  [
    '20000000-0000-4000-8000-000000000003',
    'Inglés',
    '10000000-0000-4000-8000-000000000002',
  ],
  [
    '20000000-0000-4000-8000-000000000004',
    'Excel',
    '10000000-0000-4000-8000-000000000001',
  ],
  [
    '20000000-0000-4000-8000-000000000005',
    'Diseño gráfico',
    '10000000-0000-4000-8000-000000000004',
  ],
].map(([id, nombre, categoryId]) => ({
  id_habilidad: id!,
  nombre: nombre!,
  id_categoria: categoryId!,
  estado: RecordStatus.ACTIVO,
}));

@Injectable()
export class MemorySkillsRepository implements SkillsRepository {
  private readonly records = new Map(
    seed.map((record) => [record.id_habilidad, structuredClone(record)]),
  );
  async findAll(): Promise<Skill[]> {
    return structuredClone([...this.records.values()]);
  }
  async findById(id: string): Promise<Skill | null> {
    return structuredClone(this.records.get(id) ?? null);
  }
  async create(nombre: string, categoryId: string): Promise<Skill> {
    if (
      [...this.records.values()].some(
        (record) => nameKey(record.nombre) === nameKey(nombre),
      )
    )
      throw new ConflictException('La habilidad ya existe');
    const record = {
      id_habilidad: randomUUID(),
      nombre: normalizeName(nombre),
      id_categoria: categoryId,
      estado: RecordStatus.ACTIVO,
    };
    this.records.set(record.id_habilidad, record);
    return structuredClone(record);
  }
}
