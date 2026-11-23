import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Environment } from '../../config/environment';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/google-login.dto';
import { verifyGoogleIdToken } from './google-identity';
import { EmailVerificationService } from './email-verification.service';
import { REGISTRATION_POLICY, RegistrationPolicy } from './registration-policy';
import { Inject, ConflictException } from '@nestjs/common';
import { Role } from '../../common/enums/role.enum';
import { EmailAlreadyExistsError } from '../users/users.repository';

@Injectable()
export class GoogleAuthService {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly config: ConfigService<Environment, true>,
    private readonly verification: EmailVerificationService,
    @Inject(REGISTRATION_POLICY) private readonly policy: RegistrationPolicy,
  ) {}

  async signIn(input: GoogleLoginDto, fetcher: typeof fetch = fetch) {
    const clientId = this.config.get('GOOGLE_LOGIN_CLIENT_ID', { infer: true });
    if (!clientId)
      throw new ServiceUnavailableException(
        'El inicio de sesión con Google no está configurado',
      );
    const identity = await verifyGoogleIdToken(
      input.credential,
      clientId,
      fetcher,
    );
    const repository = this.users.repository;
    const existing = await repository.findByEmail(identity.correo);
    if (existing) {
      await this.verification.verifyGoogle(existing.id, identity.subject);
      return this.auth.sessionFor((await repository.findById(existing.id))!);
    }
    if (!input.idCarrera || !input.semestre)
      return {
        registration_required: true as const,
        profile: {
          correo: identity.correo,
          nombre: identity.nombre,
          apellido: identity.apellido,
        },
      };
    if (this.policy.initialCredits === null)
      throw new ServiceUnavailableException(
        'Politica de creditos iniciales pendiente',
      );
    try {
      await repository.createStudentWithAccount({
        nombre: input.nombre ?? identity.nombre,
        apellido: input.apellido ?? identity.apellido,
        correo: identity.correo,
        passwordHash: '!google-only',
        role: Role.ESTUDIANTE,
        initialCredits: this.policy.initialCredits,
        googleSubject: identity.subject,
        idCarrera: input.idCarrera,
        semestre: input.semestre,
      });
    } catch (error) {
      if (
        !(error instanceof EmailAlreadyExistsError) &&
        !(error instanceof ConflictException)
      )
        throw error;
      const raced = await repository.findByEmail(identity.correo);
      if (!raced) throw error;
      await this.verification.verifyGoogle(raced.id, identity.subject);
    }
    const created = await repository.findByEmail(identity.correo);
    if (!created) throw new UnauthorizedException('No se pudo crear la cuenta');
    return this.auth.sessionFor(created);
  }
}
