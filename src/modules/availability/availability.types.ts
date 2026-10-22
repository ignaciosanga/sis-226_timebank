import { ApiProperty } from '@nestjs/swagger';
import { AvailabilityStatus } from '../../common/enums/record-status.enum';
export { AvailabilityStatus } from '../../common/enums/record-status.enum';

export class Availability {
  @ApiProperty({ format: 'uuid' })
  id_disponibilidad!: string;
  @ApiProperty({ format: 'uuid' })
  id_usuario!: string;
  @ApiProperty({ type: String, format: 'date-time' })
  fecha_inicio!: Date;
  @ApiProperty({ type: String, format: 'date-time' })
  fecha_fin!: Date;
  @ApiProperty({ enum: AvailabilityStatus })
  estado!: AvailabilityStatus;
}
