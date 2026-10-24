import { ApiProperty } from '@nestjs/swagger';
import { RecordStatus } from '../../common/enums/record-status.enum';

export class Career {
  @ApiProperty({ format: 'uuid' })
  id_carrera!: string;
  @ApiProperty()
  nombre!: string;
  @ApiProperty()
  facultad!: string;
  @ApiProperty({ enum: RecordStatus })
  estado!: RecordStatus;
}
export const CAREERS_REPOSITORY = Symbol('CAREERS_REPOSITORY');
export interface CareersRepository {
  findAll(): Promise<Career[]>;
  findById(id: string): Promise<Career | null>;
}
