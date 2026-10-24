import { ApiProperty } from '@nestjs/swagger';
import { RecordStatus } from '../../common/enums/record-status.enum';
import { PaginationMeta } from '../../common/dto/list-query.dto';

export class Skill {
  @ApiProperty({ format: 'uuid' })
  id_habilidad!: string;
  @ApiProperty()
  nombre!: string;
  @ApiProperty({ format: 'uuid' })
  id_categoria!: string;
  @ApiProperty({ enum: RecordStatus })
  estado!: RecordStatus;
}

export class SkillsPage {
  @ApiProperty({ type: Skill, isArray: true })
  data!: Skill[];
  @ApiProperty({ type: PaginationMeta })
  meta!: PaginationMeta;
}
