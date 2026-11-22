import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    description: 'Token recibido en el correo de verificacion',
    example: 'aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789abcd',
  })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  token!: string;
}