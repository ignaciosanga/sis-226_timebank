import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthService } from '../auth/auth.service';
import { RegisterDto } from '../auth/dto/register.dto';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { AdminUser, AdminUsersPage, PublicUser } from './user.types';
import { UsersService } from './users.service';

@ApiTags('Administración de usuarios')
@ApiBearerAuth()
@ApiUnauthorizedResponse()
@ApiForbiddenResponse({ description: 'Requiere rol ADMIN' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  @ApiOkResponse({ type: AdminUsersPage })
  @ApiOperation({
    summary:
      'Listar usuarios con búsqueda (nombre, apellido, correo) y filtros por estado, rol y carrera',
  })
  list(@Query() query: AdminUsersQueryDto) {
    return this.users.listForAdmin(query);
  }

  @Post()
  @ApiCreatedResponse({ type: PublicUser })
  @ApiBadRequestResponse({ description: 'Datos inválidos' })
  @ApiConflictResponse({ description: 'Correo no disponible' })
  @ApiOperation({
    summary:
      'Alta de estudiante por ADMIN; reutiliza el registro (Argon2id, créditos iniciales) y audita la acción',
  })
  create(@CurrentUser() admin: PublicUser, @Body() input: RegisterDto) {
    return this.auth.register(input, admin.id);
  }

  @Patch(':id/status')
  @ApiOkResponse({ type: AdminUser })
  @ApiNotFoundResponse({ description: 'Usuario inexistente' })
  @ApiConflictResponse({
    description:
      'Estado incompatible, cuenta propia, último ADMIN activo, reservas confirmadas o créditos retenidos',
  })
  @ApiOperation({
    summary: 'Baja lógica (Inactivo) o reactivación (Activo) con auditoría',
  })
  setStatus(
    @CurrentUser() admin: PublicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateUserStatusDto,
  ) {
    return this.users.setStatusByAdmin(admin.id, id, input);
  }
}
