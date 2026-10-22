import {
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '../../common/enums/role.enum';
import { UsersService } from '../users/users.service';
import { EmailAlreadyExistsError } from '../users/users.repository';
import { toPublicUser } from '../users/user.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PasswordService } from './password.service';
import { REGISTRATION_POLICY, RegistrationPolicy } from './registration-policy';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    @Inject(REGISTRATION_POLICY) private readonly policy: RegistrationPolicy,
  ) {}

  async register(input: RegisterDto) {
    const initialCredits = this.policy.initialCredits;
    if (
      !this.policy.profileOnly &&
      (initialCredits === null || !/^\d+$/.test(initialCredits))
    ) {
      throw new ServiceUnavailableException(
        'Politica de creditos iniciales pendiente',
      );
    }
    const repository = this.users.repository;
    const correo = input.correo.trim().toLowerCase();
    if (await repository.findByEmail(correo))
      throw new ConflictException('Correo no disponible');
    const passwordHash = await this.passwords.hash(input.password);
    try {
      const profile = {
        nombre: input.nombre,
        apellido: input.apellido,
        correo,
        passwordHash,
        idCarrera: input.idCarrera,
        semestre: input.semestre,
        role: Role.ESTUDIANTE as const,
      };
      const user = this.policy.profileOnly
        ? await repository.createStudentProfile(profile)
        : await repository.createStudentWithAccount({
            ...profile,
            initialCredits: initialCredits!,
          });
      return toPublicUser(user);
    } catch (error) {
      if (error instanceof EmailAlreadyExistsError)
        throw new ConflictException('Correo no disponible');
      throw error;
    }
  }

  async login(input: LoginDto) {
    const repository = this.users.repository;
    const user = await repository.findByEmail(
      input.correo.trim().toLowerCase(),
    );
    const valid = await this.passwords.verifyOrDummy(
      user?.passwordHash,
      input.password,
    );
    if (!valid || !user?.active)
      throw new UnauthorizedException('Credenciales invalidas');
    const access_token = await this.jwt.signAsync({ sub: user.id });
    if (!(await repository.recordActiveLogin(user.id, new Date())))
      throw new UnauthorizedException('Credenciales invalidas');
    return {
      access_token,
      token_type: 'Bearer' as const,
      user: toPublicUser(user),
    };
  }
}
