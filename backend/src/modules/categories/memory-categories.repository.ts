import { ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RecordStatus } from '../../common/enums/record-status.enum';
import { nameKey, normalizeName } from '../../common/utils/catalog-name';
import { CategoriesRepository } from './categories.repository';
import { Category } from './category.types';

export const DEVELOPMENT_CATEGORIES: Category[] = [
  ['10000000-0000-4000-8000-000000000001', 'Tecnología'],
  ['10000000-0000-4000-8000-000000000002', 'Idiomas'],
  ['10000000-0000-4000-8000-000000000003', 'Matemáticas'],
  ['10000000-0000-4000-8000-000000000004', 'Diseño'],
].map(([id, nombre]) => ({
  id_categoria: id!,
  nombre: nombre!,
  estado: RecordStatus.ACTIVO,
}));

@Injectable()
export class MemoryCategoriesRepository implements CategoriesRepository {
  private readonly records = new Map(
    DEVELOPMENT_CATEGORIES.map((record) => [
      record.id_categoria,
      structuredClone(record),
    ]),
  );

  async findAll(): Promise<Category[]> {
    return structuredClone([...this.records.values()]);
  }
  async findById(id: string): Promise<Category | null> {
    return structuredClone(this.records.get(id) ?? null);
  }
  async create(nombre: string): Promise<Category> {
    if (
      [...this.records.values()].some(
        (record) => nameKey(record.nombre) === nameKey(nombre),
      )
    )
      throw new ConflictException('La categoria ya existe');
    const record = {
      id_categoria: randomUUID(),
      nombre: normalizeName(nombre),
      estado: RecordStatus.ACTIVO,
    };
    this.records.set(record.id_categoria, record);
    return structuredClone(record);
  }
}
