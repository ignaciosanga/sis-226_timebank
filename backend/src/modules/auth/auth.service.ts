import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
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
import { VerificationEmailService } from './verification-email.service';

export interface RegisterOptions {
  createdBy?: string;
  correoVerificado?: boolean;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    @Inject(REGISTRATION_POLICY) private readonly policy: RegistrationPolicy,
    private readonly verificationEmail: VerificationEmailService,
  ) {}

  /** Las opciones son internas y nunca proceden directamente del body HTTP. */
  async register(input: RegisterDto, options: RegisterOptions = {}) {
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

    if (await repository.findByEmail(correo)) {
      throw new ConflictException('Correo no disponible');
    }

    const passwordHash = await this.passwords.hash(input.password);
    const correoVerificado = options.correoVerificado ?? false;

    let user: UserRecord;

    try {
      const profile = {
        nombre: input.nombre,
        apellido: input.apellido,
        correo,
        passwordHash,
        idCarrera: input.idCarrera,
        semestre: input.semestre,
        role: Role.ESTUDIANTE as const,
        correoVerificado,
        ...(options.createdBy ? { createdBy: options.createdBy } : {}),
      };

      user = this.policy.profileOnly
        ? await repository.createStudentProfile(profile)
        : await repository.createStudentWithAccount({
            ...profile,
            initialCredits: initialCredits!,
          });
    } catch (error) {
      if (error instanceof EmailAlreadyExistsError) {
        throw new ConflictException('Correo no disponible');
      }
      throw error;
    }

    if (!correoVerificado) {
      try {
        await this.issueVerificationToken(user.id, correo);
      } catch {
        // La cuenta ya existe. Podrá solicitar otro correo posteriormente.
        this.logger.warn(
          `No se pudo enviar el correo de verificacion al usuario ${user.id}`,
        );
      }
    }

    return toPublicUser(user);
  }

  private async issueVerificationToken(
    userId: string,
    correo: string,
  ): Promise<void> {
    const token = randomBytes(32).toString('base64url');

    const tokenHash = createHash('sha256')
      .update(token)
      .digest('hex');

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const saved = await this.users.repository.setEmailVerificationToken(
      userId,
      tokenHash,
      expiresAt,
    );

    if (!saved) {
      throw new ServiceUnavailableException(
        'No se pudo preparar la verificacion del correo',
      );
    }

    await this.verificationEmail.sendVerificationEmail(correo, token);
  }

  async verifyEmail(token: string) {
    const normalizedToken = token.trim();

    if (!normalizedToken || normalizedToken.length > 128) {
      throw new BadRequestException('Token invalido o vencido');
    }

    const tokenHash = createHash('sha256')
      .update(normalizedToken)
      .digest('hex');

    const user = await this.users.repository.verifyEmailToken(
      tokenHash,
      new Date(),
    );

    if (!user) {
      throw new BadRequestException('Token invalido o vencido');
    }

    return {
      message: 'Correo verificado correctamente',
    };
  }

  async resendVerification(correo: string) {
    const genericResponse = {
      message:
        'Si la cuenta existe y necesita verificacion, recibiras un correo con las instrucciones.',
    };

    const normalizedEmail = correo.trim().toLowerCase();
    const user = await this.users.repository.findByEmail(normalizedEmail);

    if (!user || !user.active || user.correoVerificado) {
      return genericResponse;
    }

    try {
      await this.issueVerificationToken(user.id, user.correo);
    } catch {
      this.logger.warn(
        'No se pudo procesar el reenvio de verificacion de correo',
      );
    }

    return genericResponse;
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

    if (!valid || !user?.active) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    if (!user.correoVerificado) {
      throw new ForbiddenException(
        'Debes verificar tu correo antes de iniciar sesion',
      );
    }

    return this.sessionFor(user);
  }

  async sessionFor(user: UserRecord) {
    if (!user.active) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    if (!user.correoVerificado) {
      throw new ForbiddenException(
        'Debes verificar tu correo antes de iniciar sesion',
      );
    }

    const access_token = await this.jwt.signAsync({ sub: user.id });

    if (!(await this.users.repository.recordActiveLogin(user.id, new Date()))) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    return {
      access_token,
      token_type: 'Bearer' as const,
      user: toPublicUser(user),
    };
  }
}