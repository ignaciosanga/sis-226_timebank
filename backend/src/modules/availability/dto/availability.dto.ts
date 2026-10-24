import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsString, Matches, ValidateIf } from 'class-validator';

// Perfil ISO 8601 admitido: fecha completa, hora/minutos y zona Z o ±HH:mm.
// No se admiten fechas locales, offsets > 14:00 ni horas 24:00.
const zonedTimestamp =
  /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00))$/;

export class CreateAvailabilityDto {
  @ApiProperty({ format: 'date-time', example: '2026-11-02T09:00:00-04:00' })
  @IsString()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(zonedTimestamp, {
    message: 'fechaInicio debe incluir zona horaria explicita (Z o ±HH:mm)',
  })
  fechaInicio!: string;

  @ApiProperty({ format: 'date-time', example: '2026-11-02T10:00:00-04:00' })
  @IsString()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(zonedTimestamp, {
    message: 'fechaFin debe incluir zona horaria explicita (Z o ±HH:mm)',
  })
  fechaFin!: string;
}

export class UpdateAvailabilityDto {
  @ApiPropertyOptional({ format: 'date-time' })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(zonedTimestamp, {
    message: 'fechaInicio debe incluir zona horaria explicita (Z o ±HH:mm)',
  })
  fechaInicio?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(zonedTimestamp, {
    message: 'fechaFin debe incluir zona horaria explicita (Z o ±HH:mm)',
  })
  fechaFin?: string;
}
