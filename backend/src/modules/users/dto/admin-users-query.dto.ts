import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';
import { UserStatus } from '../../../common/enums/record-status.enum';
import { DatabaseRole } from '../../../common/enums/role.enum';

export class AdminUsersQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  estado?: UserStatus;

  @ApiPropertyOptional({ enum: DatabaseRole })
  @IsOptional()
  @IsEnum(DatabaseRole)
  rol?: DatabaseRole;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  idCarrera?: string;
}
