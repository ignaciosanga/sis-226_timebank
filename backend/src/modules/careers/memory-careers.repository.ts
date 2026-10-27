import { Injectable } from '@nestjs/common';
import { RecordStatus } from '../../common/enums/record-status.enum';
import { Career, CareersRepository } from './careers.repository';

// Datos exclusivamente de desarrollo; nunca se insertan en PostgreSQL.
const careers: Career[] = [
  {
    id_carrera: '30000000-0000-4000-8000-000000000001',
    nombre: 'Ingeniería de Sistemas',
    facultad: 'Ciencias y Tecnología',
    estado: RecordStatus.ACTIVO,
  },
];
@Injectable()
export class MemoryCareersRepository implements CareersRepository {
  async findAll(): Promise<Career[]> {
    return structuredClone(careers);
  }
  async findById(id: string): Promise<Career | null> {
    return structuredClone(
      careers.find((row) => row.id_carrera === id) ?? null,
    );
  }
}
