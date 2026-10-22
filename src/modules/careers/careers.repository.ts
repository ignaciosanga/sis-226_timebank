import { RecordStatus } from '../../common/enums/record-status.enum';

export class Career {
  id_carrera!: string;
  nombre!: string;
  facultad!: string;
  estado!: RecordStatus;
}
export const CAREERS_REPOSITORY = Symbol('CAREERS_REPOSITORY');
export interface CareersRepository {
  findAll(): Promise<Career[]>;
  findById(id: string): Promise<Career | null>;
}
