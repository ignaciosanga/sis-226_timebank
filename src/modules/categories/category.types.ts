import { ApiProperty } from '@nestjs/swagger';
import { RecordStatus } from '../../common/enums/record-status.enum';
import { PaginationMeta } from '../../common/dto/list-query.dto';

export class Category {
  @ApiProperty({ format: 'uuid' })
  id_categoria!: string;
  @ApiProperty()
  nombre!: string;
  @ApiProperty({ enum: RecordStatus })
  estado!: RecordStatus;
}

export class CategoriesPage {
  @ApiProperty({ type: Category, isArray: true })
  data!: Category[];
  @ApiProperty({ type: PaginationMeta })
  meta!: PaginationMeta;
}
