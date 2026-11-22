import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MaxLength } from 'class-validator';

export class ResendVerificationDto {
  @ApiProperty({
    example: 'estudiante@ucb.edu.bo',
  })
  @IsEmail()
  @MaxLength(254)
  correo!: string;
}