import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { UserStatus } from '../../../common/enums/record-status.enum';
import { AdminUserStatus } from '../users.repository';

export class UpdateUserStatusDto {
  @ApiProperty({
    enum: [UserStatus.ACTIVO, UserStatus.INACTIVO],
    description: 'Inactivo = baja logica; Activo = reactivacion',
  })
  @IsIn([UserStatus.ACTIVO, UserStatus.INACTIVO])
  estado!: AdminUserStatus;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(255)
  motivo?: string;
}
