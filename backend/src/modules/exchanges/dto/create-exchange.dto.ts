import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';
import { CreateAvailabilityDto } from '../../availability/dto/availability.dto';

export class CreateExchangeDto extends CreateAvailabilityDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  providerId!: string;
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  skillId!: string;
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  availabilityId!: string;
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Opcional: debe coincidir con la oferta resuelta por availabilityId. El precio procede del servidor.',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID()
  offerId?: string;
  @ApiPropertyOptional({ maxLength: 500 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(500)
  descripcion?: string;
}
