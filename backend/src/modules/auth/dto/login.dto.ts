import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'ana@example.test', format: 'email' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  correo!: string;

  @ApiProperty({
    minLength: 1,
    maxLength: 128,
    writeOnly: true,
    format: 'password',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}
