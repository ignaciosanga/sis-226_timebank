import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, ValidateIf } from 'class-validator';
import {
  ListQueryDto,
  PaginationMeta,
} from '../../../common/dto/list-query.dto';
import { SkillLevel } from '../../user-skills/user-skill.types';

export class ProvidersQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: SkillLevel })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(SkillLevel)
  nivel?: SkillLevel;
}

export class SkillProvider {
  @ApiProperty({ format: 'uuid' })
  id_usuario!: string;
  @ApiProperty({ description: 'Nombre completo del ofertante' })
  nombre!: string;
  @ApiProperty({ format: 'uuid' })
  id_habilidad!: string;
  @ApiProperty()
  habilidad!: string;
  @ApiProperty({ enum: SkillLevel })
  nivel!: SkillLevel;
}

export class SkillProvidersPage {
  @ApiProperty({ type: SkillProvider, isArray: true })
  data!: SkillProvider[];
  @ApiProperty({ type: PaginationMeta })
  meta!: PaginationMeta;
}
