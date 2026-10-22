import {
  Inject,
  Injectable,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { USERS_REPOSITORY, UsersRepository } from './users.repository';
import { PublicUser, UserRecord, toPublicUser } from './user.types';
import { UpdateProfileDto } from './dto/update-profile.dto';

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
}
