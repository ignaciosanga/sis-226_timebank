import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '../../common/enums/role.enum';
import { UsersService } from '../users/users.service';
import { EmailAlreadyExistsError } from '../users/users.repository';
import { toPublicUser, UserRecord } from '../users/user.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PasswordService } from './password.service';
import { REGISTRATION_POLICY, RegistrationPolicy } from './registration-policy';
import { EmailVerificationService } from './email-verification.service';
import { UserStatus } from '../../common/enums/record-status.enum';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    @Inject(REGISTRATION_POLICY) private readonly policy: RegistrationPolicy,
    private readonly verification: EmailVerificationService,
  ) {}

  /** createdBy: ADMIN que da de alta desde /admin/users; nunca viene del body. */
  async register(input: RegisterDto, createdBy?: string) {
    const initialCredits = this.policy.initialCredits;
    if (initialCredits === null || !/^\d+$/.test(initialCredits)) {
      throw new ServiceUnavailableException(
        'Politica de creditos iniciales pendiente',
      );
    }
    const repository = this.users.repository;
    const correo = input.correo.trim().toLowerCase();
    const existing = await repository.findByEmail(correo);
    if (existing && existing.estado !== UserStatus.PENDIENTE)
      throw new ConflictException('Correo no disponible');
    const passwordHash = await this.passwords.hash(input.password);
    if (existing) {
      const challenge = this.verification.challenge();
      const user = await this.verification.replacePending(
        existing.id,
        {
          nombre: input.nombre,
          apellido: input.apellido,
          id_carrera: input.idCarrera,
          semestre: input.semestre,
          password_hash: passwordHash,
        },
        challenge.stored,
      );
      await this.verification.deliver(correo, challenge.token);
      return { ...toPublicUser(user), verification_required: true as const };
    }
    try {
      const profile = {
        nombre: input.nombre,
        apellido: input.apellido,
        correo,
        passwordHash,
        idCarrera: input.idCarrera,
        semestre: input.semestre,
        role: Role.ESTUDIANTE as const,
        ...(createdBy ? { createdBy } : {}),
      };
      const challenge = this.verification.challenge();
      const user = await repository.createStudentWithAccount({
        ...profile,
        initialCredits: '0',
        verification: challenge.stored,
      });
      await this.verification.deliver(correo, challenge.token);
      return { ...toPublicUser(user), verification_required: true as const };
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
    if (valid && user?.estado === UserStatus.PENDIENTE)
      throw new ForbiddenException({
        code: 'EMAIL_VERIFICATION_REQUIRED',
        message: 'Confirma tu correo antes de iniciar sesion',
      });
    if (!valid || !user?.active)
      throw new UnauthorizedException('Credenciales invalidas');
    return this.sessionFor(user);
  }

  async confirmEmail(token: string, password?: string) {
    if (password === undefined) return this.verification.confirm(token);
    const ownerId = await this.verification.pendingOwner(token);
    const owner = ownerId
      ? await this.users.repository.findById(ownerId)
      : null;
    const valid = await this.passwords.verifyOrDummy(
      owner?.passwordHash,
      password,
    );
    if (!ownerId || !valid)
      throw new UnauthorizedException(
        'La contraseña no coincide con la de esta cuenta',
      );
    await this.verification.confirm(token);
    const user = await this.users.repository.findById(ownerId);
    if (!user) throw new UnauthorizedException('Credenciales invalidas');
    return {
      status: 'verified' as const,
      login_required: false as const,
      ...(await this.sessionFor(user)),
    };
  }

  async sessionFor(user: UserRecord) {
    if (!user.active) throw new UnauthorizedException('Credenciales invalidas');
    const access_token = await this.jwt.signAsync({
      sub: user.id,
      purpose: 'session',
    });
    if (!(await this.users.repository.recordActiveLogin(user.id, new Date())))
      throw new UnauthorizedException('Credenciales invalidas');
    return {
      access_token,
      token_type: 'Bearer' as const,
      user: toPublicUser(user),
    };
  }
}
