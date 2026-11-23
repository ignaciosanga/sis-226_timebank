import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    description:
      'Credencial de un solo uso recibida por correo; nunca es un Bearer de sesion',
    minLength: 43,
    maxLength: 43,
  })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  token!: string;

  @ApiPropertyOptional({
    description:
      'Contraseña elegida al registrarse; si se envía y coincide, activa la cuenta e inicia sesión',
    maxLength: 128,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password?: string;
}

export class ResendVerificationDto {
  @ApiProperty({ format: 'email', example: 'ana@ucb.edu.bo' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  correo!: string;
}
