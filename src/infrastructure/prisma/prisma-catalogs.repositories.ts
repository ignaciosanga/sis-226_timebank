import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RecordStatus } from '../../common/enums/record-status.enum';
import { nameKey, normalizeName } from '../../common/utils/catalog-name';
import {
  Career,
  CareersRepository,
} from '../../modules/careers/careers.repository';
import { CategoriesRepository } from '../../modules/categories/categories.repository';
import { Category } from '../../modules/categories/category.types';
import { Skill } from '../../modules/skills/skill.types';
import { SkillsRepository } from '../../modules/skills/skills.repository';
import { PrismaService } from './prisma.service';

const careerSelect = {
  id_carrera: true,
  nombre: true,
  facultad: true,
  estado: true,
} as const;
const categorySelect = {
  id_categoria: true,
  nombre: true,
  estado: true,
} as const;
const skillSelect = {
  id_habilidad: true,
  nombre: true,
  id_categoria: true,
  estado: true,
} as const;

function mapStatus<T extends { estado: string }>(
  record: T,
): Omit<T, 'estado'> & { estado: RecordStatus } {
  if (
    record.estado !== RecordStatus.ACTIVO &&
    record.estado !== RecordStatus.INACTIVO
  ) {
    throw new ServiceUnavailableException(
      'Estado de catalogo incompatible con el modelo optimizado',
    );
  }
  return { ...record, estado: record.estado };
}

function uniqueConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

@Injectable()
export class PrismaCareersRepository implements CareersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Career[]> {
    const client = await this.prisma.connect();
    const records = await client.carrera.findMany({
      select: careerSelect,
      orderBy: [{ nombre: 'asc' }, { id_carrera: 'asc' }],
    });
    return records.map(mapStatus);
  }

  async findById(id: string): Promise<Career | null> {
    const client = await this.prisma.connect();
    const record = await client.carrera.findUnique({
      where: { id_carrera: id },
      select: careerSelect,
    });
    return record ? mapStatus(record) : null;
  }
}

@Injectable()
export class PrismaCategoriesRepository implements CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Category[]> {
    const client = await this.prisma.connect();
    const records = await client.categoria.findMany({
      select: categorySelect,
      orderBy: [{ nombre: 'asc' }, { id_categoria: 'asc' }],
    });
    return records.map(mapStatus);
  }

  async findById(id: string): Promise<Category | null> {
    const client = await this.prisma.connect();
    const record = await client.categoria.findUnique({
      where: { id_categoria: id },
      select: categorySelect,
    });
    return record ? mapStatus(record) : null;
  }

  async create(nombre: string): Promise<Category> {
    const client = await this.prisma.connect();
    try {
      return await client.$transaction(
        async (transaction) => {
          // Comparte el bloqueo con la unidad de trabajo de intercambios.
          await transaction.$queryRaw`SELECT pg_advisory_xact_lock(22603112)::text AS locked`;
          const existing = await transaction.categoria.findMany({
            select: { nombre: true },
          });
          if (existing.some((row) => nameKey(row.nombre) === nameKey(nombre))) {
            throw new ConflictException('La categoria ya existe');
          }
          const record = await transaction.categoria.create({
            data: {
              id_categoria: randomUUID(),
              nombre: normalizeName(nombre),
              estado: RecordStatus.ACTIVO,
            },
            select: categorySelect,
          });
          return mapStatus(record);
        },
        { isolationLevel: 'ReadCommitted' },
      );
    } catch (error: unknown) {
      if (uniqueConflict(error)) {
        throw new ConflictException('La categoria ya existe');
      }
      throw error;
    }
  }
}

@Injectable()
export class PrismaSkillsRepository implements SkillsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Skill[]> {
    const client = await this.prisma.connect();
    const records = await client.habilidad.findMany({
      select: skillSelect,
      orderBy: [{ nombre: 'asc' }, { id_habilidad: 'asc' }],
    });
    return records.map(mapStatus);
  }

  async findById(id: string): Promise<Skill | null> {
    const client = await this.prisma.connect();
    const record = await client.habilidad.findUnique({
      where: { id_habilidad: id },
      select: skillSelect,
    });
    return record ? mapStatus(record) : null;
  }

  async create(nombre: string, categoryId: string): Promise<Skill> {
    const client = await this.prisma.connect();
    try {
      return await client.$transaction(
        async (transaction) => {
          await transaction.$queryRaw`SELECT pg_advisory_xact_lock(22603112)::text AS locked`;
          // El controlador pudo comprobarla antes; se valida de nuevo al escribir.
          const category = await transaction.categoria.findUnique({
            where: { id_categoria: categoryId },
            select: categorySelect,
          });
          if (!category || category.estado !== RecordStatus.ACTIVO) {
            throw new NotFoundException('Categoria activa no encontrada');
          }
          const existing = await transaction.habilidad.findMany({
            select: { nombre: true },
          });
          if (existing.some((row) => nameKey(row.nombre) === nameKey(nombre))) {
            throw new ConflictException('La habilidad ya existe');
          }
          const record = await transaction.habilidad.create({
            data: {
              id_habilidad: randomUUID(),
              nombre: normalizeName(nombre),
              id_categoria: categoryId,
              estado: RecordStatus.ACTIVO,
            },
            select: skillSelect,
          });
          return mapStatus(record);
        },
        { isolationLevel: 'ReadCommitted' },
      );
    } catch (error: unknown) {
      if (uniqueConflict(error)) {
        throw new ConflictException('La habilidad ya existe');
      }
      throw error;
    }
  }
}
