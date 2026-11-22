import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class AssistantTurnDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @ApiProperty({ maxLength: 1200 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(1200)
  content!: string;
}

export class AskAssistantDto {
  @ApiProperty({ example: '¿Cómo reservo una tutoría?', maxLength: 500 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  question!: string;

  @ApiPropertyOptional({
    type: [AssistantTurnDto],
    maxItems: 6,
    description:
      'Últimos turnos de la conversación, del más antiguo al más reciente',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => AssistantTurnDto)
  history?: AssistantTurnDto[];
}

export class AssistantAnswerDto {
  @ApiProperty({
    example: 'Busca la materia en Habilidades, elige una oferta…',
  })
  answer!: string;
}
