import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { CreateAvailabilityDto } from '../../availability/dto/availability.dto';
import { SkillLevel } from '../../user-skills/user-skill.types';
import { OFFER_PRICE_PATTERN } from '../offer-price';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateOfferDto extends CreateAvailabilityDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Habilidad activa que el tutor ya ofrece en su perfil',
  })
  @IsUUID()
  skillId!: string;

  @ApiProperty({ enum: SkillLevel })
  @IsEnum(SkillLevel)
  nivel!: SkillLevel;

  @ApiProperty({ minLength: 1, maxLength: 100 })
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  titulo!: string;

  @ApiProperty({ minLength: 1, maxLength: 1500 })
  @Transform(trim)
  @IsString()
  @Length(1, 1500)
  descripcion!: string;

  @ApiProperty({
    type: String,
    example: '3.7',
    description:
      'Precio total manual en esquemas anteriores. En SkillSwap v4 se conserva el campo por compatibilidad, pero el servidor calcula el precio efectivo con config_economia. Texto exacto positivo con hasta una décima.',
  })
  @IsString()
  @Matches(OFFER_PRICE_PATTERN, {
    message:
      'costoCreditos debe ser texto positivo entero o con una decima; no se admiten centesimas ni exponentes',
  })
  costoCreditos!: string;

  @ApiPropertyOptional({
    description:
      'URL absoluta devuelta por POST /tutoring/banners para este tutor',
  })
  @ValidateIf((_obj, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(2048)
  bannerUrl?: string;
}
