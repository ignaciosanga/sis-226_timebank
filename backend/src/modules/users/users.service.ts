import {
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { USERS_REPOSITORY, UsersRepository } from './users.repository';
import {
  AdminUser,
  PublicUser,
  UserRecord,
  toAdminUser,
  toPublicUser,
} from './user.types';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { Role } from '../../common/enums/role.enum';
import { Page, paginate } from '../../common/dto/list-query.dto';

@Injectable()
export class UsersService {
  constructor(
    @Optional()
    @Inject(USERS_REPOSITORY)
    private readonly persistence?: UsersRepository,
  ) {}

  get repository(): UsersRepository {
    if (!this.persistence)
      throw new ServiceUnavailableException(
        'Integracion oficial de usuarios pendiente',
      );
    return this.persistence;
  }

  async requireActive(id: string): Promise<UserRecord> {
    const user = await this.repository.findById(id);
    if (!user?.active)
      throw new UnauthorizedException('Autenticacion invalida');
    return user;
  }

  async me(authenticatedId: string): Promise<PublicUser> {
    return toPublicUser(await this.requireActive(authenticatedId));
  }

  async requirePublishedStudent(id: string): Promise<void> {
    const user = await this.repository.findById(id);
    if (!user?.active || !user.roles.includes(Role.ESTUDIANTE))
      throw new NotFoundException('Estudiante activo no encontrado');
  }

  async updateMe(
    authenticatedId: string,
    input: UpdateProfileDto,
  ): Promise<PublicUser> {
    await this.requireActive(authenticatedId);
    // Lista explicita de campos para impedir elevacion de privilegios incluso fuera de HTTP.
    const allowed: UpdateProfileDto = {};
    if (input.nombre !== undefined) allowed.nombre = input.nombre;
    if (input.apellido !== undefined) allowed.apellido = input.apellido;
    if (input.idCarrera !== undefined) allowed.idCarrera = input.idCarrera;
    if (input.semestre !== undefined) allowed.semestre = input.semestre;
    const user = await this.repository.updateActiveProfile(
      authenticatedId,
      allowed,
    );
    if (!user?.active)
      throw new UnauthorizedException('Autenticacion invalida');
    return toPublicUser(user);
  }

  async listForAdmin(query: AdminUsersQueryDto): Promise<Page<AdminUser>> {
    const users = await this.repository.listForAdmin({
      search: query.search,
      estado: query.estado,
      rol: query.rol,
      idCarrera: query.idCarrera,
    });
    return paginate(users.map(toAdminUser), query);
  }

  async setStatusByAdmin(
    adminId: string,
    userId: string,
    input: UpdateUserStatusDto,
  ): Promise<AdminUser> {
    return toAdminUser(
      await this.repository.setStatusByAdmin(
        adminId,
        userId,
        input.estado,
        input.motivo,
      ),
    );
  }
}
