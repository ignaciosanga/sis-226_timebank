import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
  MinLength,
  IsUUID,
  Max,
  Matches,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Ana', maxLength: 100 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre!: string;

  @ApiProperty({ example: 'Pérez', maxLength: 100 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  apellido!: string;

  @ApiProperty({
    example: 'ana@ucb.edu.bo',
    format: 'email',
    description: 'Dominio exacto ucb.edu.bo; se normaliza antes de validar',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @Matches(/^[^@\s]+@ucb\.edu\.bo$/, {
    message: 'El correo debe pertenecer al dominio exacto @ucb.edu.bo',
  })
  @MaxLength(254)
  correo!: string;

  @ApiProperty({
    minLength: 12,
    maxLength: 128,
    writeOnly: true,
    format: 'password',
  })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @ApiProperty({
    example: '30000000-0000-4000-8000-000000000001',
    description: 'UUID de una carrera activa obtenida de GET /careers',
  })
  @IsUUID()
  idCarrera!: string;

  @ApiProperty({ example: 3, minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(12)
  semestre!: number;
}
