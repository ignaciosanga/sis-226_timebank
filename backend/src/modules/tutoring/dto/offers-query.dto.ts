import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, Matches, ValidateIf } from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class OffersQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsUUID()
  skillId?: string;
  @ApiPropertyOptional({ example: 'SIS-111' })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @Matches(/^[A-Z]{2,4}-\d{3}$/)
  codigo?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsUUID()
  tutorId?: string;
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Excluir tutor al consultar otros tutores',
  })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsUUID()
  excludeTutorId?: string;
}
