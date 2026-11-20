import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class GrantCreditsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId!: string;
  @ApiProperty({
    example: '8',
    description:
      'Creditos como texto, entero o una decima; las bases con esquema entero siguen rechazando fracciones. Carga de desarrollo.',
  })
  @IsString()
  @MaxLength(16)
  @Matches(/^\d+(?:\.\d)?$/)
  amount!: string;
  @ApiProperty({ maxLength: 500 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
