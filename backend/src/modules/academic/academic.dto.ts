import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ListQueryDto } from '../../common/dto/list-query.dto';

export class RoadmapUpdateDto {
  @ApiProperty({ enum: ['approved', 'current', 'pending'] })
  @IsIn(['approved', 'current', 'pending'])
  estado!: 'approved' | 'current' | 'pending';
}

export class ReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  calificacion!: number;

  @ApiPropertyOptional({ maxLength: 500, default: '' })
  @IsString()
  @MaxLength(500)
  comentario = '';
}

export class ReviewsQueryDto extends ListQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  tutorId!: string;
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  skillId!: string;
}

export class CurriculumQueryDto {
  @ApiPropertyOptional()
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @Matches(/^[A-Z]{2,4}-\d{3}$/)
  codigo?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 9 })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  @Max(9)
  semestre?: number;

  @ApiPropertyOptional({
    enum: [
      'basicas',
      'software',
      'ia',
      'informacion',
      'infraestructura',
      'general',
    ],
  })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsIn([
    'basicas',
    'software',
    'ia',
    'informacion',
    'infraestructura',
    'general',
  ])
  area?: string;
}

export class AcademicPeriodDto extends CurriculumQueryDto {
  @ApiPropertyOptional({ description: 'ISO-8601 con zona; incluido' })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  from?: string;

  @ApiPropertyOptional({ description: 'ISO-8601 con zona; excluido' })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  to?: string;
}

export class ClassesQueryDto extends AcademicPeriodDto {
  @ApiPropertyOptional({ default: 1 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  page = 1;
  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
