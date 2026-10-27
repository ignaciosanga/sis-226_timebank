import { randomBytes } from 'node:crypto';
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

@Injectable()
export class GoogleAuthService {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly config: ConfigService<Environment, true>,
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
    if (existing) return this.auth.sessionFor(existing);
    if (!input.idCarrera || !input.semestre)
      return { registration_required: true as const, profile: identity };
    await this.auth.register({
      nombre: input.nombre ?? identity.nombre,
      apellido: input.apellido ?? identity.apellido,
      correo: identity.correo,
      password: randomBytes(48).toString('base64url'),
      idCarrera: input.idCarrera,
      semestre: input.semestre,
    });
    const created = await repository.findByEmail(identity.correo);
    if (!created) throw new UnauthorizedException('No se pudo crear la cuenta');
    return this.auth.sessionFor(created);
  }
}
