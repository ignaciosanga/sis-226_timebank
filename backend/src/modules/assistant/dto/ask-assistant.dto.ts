import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  AVATAR_ACCESSORIES,
  AVATAR_COLORS,
  AVATAR_STYLES,
  type AvatarAccessory,
  type AvatarColor,
  type AvatarStyle,
} from '../assistant-profile.store';

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

  @ApiPropertyOptional({ example: '/perfil', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^\/[a-z0-9/_-]*$/)
  route?: string;
}

export class AssistantAvatarDto {
  @ApiProperty({ enum: AVATAR_STYLES })
  @IsIn(AVATAR_STYLES)
  estilo!: AvatarStyle;

  @ApiProperty({ enum: AVATAR_COLORS })
  @IsIn(AVATAR_COLORS)
  color!: AvatarColor;

  @ApiProperty({ enum: AVATAR_ACCESSORIES })
  @IsIn(AVATAR_ACCESSORIES)
  accesorio!: AvatarAccessory;

  @ApiProperty({ example: 'Nexo', maxLength: 24 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(24)
  @Matches(/^[\p{L}\p{N} ]+$/u, {
    message: 'El nombre solo admite letras, números y espacios',
  })
  nombre!: string;
}

export class AssistantKeyDto {
  @ApiProperty({ description: 'API key personal de Groq (gsk_…)' })
  @Transform(trim)
  @IsString()
  @Matches(/^gsk_[A-Za-z0-9]{20,120}$/, {
    message: 'La API key de Groq empieza con gsk_',
  })
  apiKey!: string;
}

export class AssistantActionDto {
  @ApiProperty({ enum: ['navigate'] })
  type!: 'navigate';
  @ApiProperty({ example: '/perfil' })
  route!: string;
  @ApiPropertyOptional({ example: 'anadir-habilidad', nullable: true })
  target!: string | null;
  @ApiProperty({ example: 'Añadir una materia a tu perfil' })
  label!: string;
}

export class AssistantOfferCardDto {
  @ApiProperty({ format: 'uuid' }) id_oferta!: string;
  @ApiProperty() titulo!: string;
  @ApiProperty() materia!: string;
  @ApiProperty() tutor!: string;
  @ApiProperty({ example: '3.5' }) costo_creditos!: string;
  @ApiProperty() fecha_inicio!: string;
}

export class AssistantQuotaDto {
  @ApiProperty() llavePropia!: boolean;
  @ApiProperty() limite!: number;
  @ApiProperty() usados!: number;
  @ApiProperty() restantes!: number;
}

export class AssistantProposalDto {
  @ApiProperty({ enum: ['solicitar_tutoria', 'ofertar_habilidad'] })
  tipo!: 'solicitar_tutoria' | 'ofertar_habilidad';
  @ApiProperty({ example: 'Solicitar Cálculo I con Ana Rojas' })
  resumen!: string;
  @ApiPropertyOptional({ format: 'uuid' }) id_oferta?: string;
  @ApiPropertyOptional({ format: 'uuid' }) providerId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) availabilityId?: string;
  @ApiProperty({ format: 'uuid' }) skillId!: string;
  @ApiProperty() materia!: string;
  @ApiPropertyOptional() tutor?: string;
  @ApiPropertyOptional() titulo?: string;
  @ApiPropertyOptional({ example: '3.5' }) costo_creditos?: string;
  @ApiPropertyOptional({ format: 'date-time' }) fechaInicio?: string;
  @ApiPropertyOptional({ format: 'date-time' }) fechaFin?: string;
  @ApiPropertyOptional({
    enum: ['Basico', 'Intermedio', 'Avanzado', 'Experto'],
  })
  nivel?: string;
  @ApiPropertyOptional() tieneHabilidad?: boolean;
}

export class AssistantAnswerDto {
  @ApiProperty({ example: 'Te llevo a tu perfil…' })
  answer!: string;
  @ApiProperty({ type: [AssistantActionDto] })
  actions!: AssistantActionDto[];
  @ApiProperty({ type: [AssistantOfferCardDto] })
  offers!: AssistantOfferCardDto[];
  @ApiProperty({ type: AssistantProposalDto, nullable: true })
  proposal!: AssistantProposalDto | null;
  @ApiProperty({ type: AssistantQuotaDto })
  quota!: AssistantQuotaDto;
}

export class AssistantProfileDto {
  @ApiProperty({ type: AssistantAvatarDto })
  avatar!: AssistantAvatarDto;
  @ApiProperty({ example: 'gsk_…a1b2', nullable: true })
  llavePista!: string | null;
  @ApiProperty({ type: AssistantQuotaDto })
  quota!: AssistantQuotaDto;
  @ApiProperty({
    description: 'Si el servidor puede guardar llaves cifradas',
  })
  llavesHabilitadas!: boolean;
}
