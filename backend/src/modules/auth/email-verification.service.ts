import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { UserStatus } from '../../common/enums/record-status.enum';
import { Environment } from '../../config/environment';
import {
  EXCHANGE_REPOSITORY,
  ExchangeRepository,
} from '../exchanges/exchange.repository';
import { adaptStoredUser, StoredUser, UserRecord } from '../users/user.types';
import { UsersService } from '../users/users.service';
import { activateAccount } from './account-activation';
import { REGISTRATION_POLICY, RegistrationPolicy } from './registration-policy';
import { VerificationMailer } from './verification-mailer';

export const verificationHash = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class EmailVerificationService {
  constructor(
    @Inject(EXCHANGE_REPOSITORY)
    private readonly persistence: ExchangeRepository,
    private readonly users: UsersService,
    private readonly config: ConfigService<Environment, true>,
    @Inject(REGISTRATION_POLICY) private readonly policy: RegistrationPolicy,
    private readonly mailer: VerificationMailer,
  ) {}

  challenge() {
    this.mailer.assertConfigured();
    const token = randomBytes(32).toString('base64url');
    const now = new Date(Date.now());
    return {
      token,
      stored: {
        id_verificacion: randomUUID(),
        token_hash: verificationHash(token),
        created_at: now,
        expires_at: new Date(
          now.getTime() +
            this.config.get('EMAIL_VERIFICATION_TTL_MINUTES', { infer: true }) *
              60000,
        ),
        consumed_at: null,
      },
    };
  }

  async deliver(correo: string, token: string): Promise<void> {
    try {
      await this.mailer.send(correo, token);
    } catch {
      // No deja una credencial utilizable cuyo correo no pudo entregarse.
      await this.persistence.transaction((state) => {
        const row = state.verifications.get(verificationHash(token));
        if (row) row.consumed_at ??= new Date(Date.now());
      });
      throw new ServiceUnavailableException(
        'No se pudo enviar el correo; solicita un nuevo enlace de verificacion',
      );
    }
  }

  async resend(correo: string) {
    const user = await this.users.repository.findByEmail(
      correo.trim().toLowerCase(),
    );
    if (user?.estado === UserStatus.PENDIENTE) {
      const challenge = this.challenge();
      const issued = await this.persistence.transaction((state) => {
        const row = state.users.get(user.id);
        if (row?.estado !== UserStatus.PENDIENTE) return false;
        const now = challenge.stored.created_at;
        const prior = [...state.verifications.values()].filter(
          (t) => t.id_usuario === row.id_usuario && !t.consumed_at,
        );
        if (prior.some((t) => now.getTime() - t.created_at.getTime() < 60000))
          return false;
        for (const token of prior) token.consumed_at = now;
        state.verifications.set(challenge.stored.token_hash, {
          ...challenge.stored,
          id_usuario: row.id_usuario,
        });
        return true;
      });
      if (issued) await this.deliver(user.correo, challenge.token);
    }
    return {
      message:
        'Si existe una cuenta pendiente, recibiras un enlace de verificacion',
    };
  }

  pendingOwner(token: string): Promise<string | null> {
    return this.persistence.read(
      (state) =>
        state.verifications.get(verificationHash(token))?.id_usuario ?? null,
    );
  }

  async replacePending(
    userId: string,
    changes: Pick<
      StoredUser,
      'nombre' | 'apellido' | 'id_carrera' | 'semestre' | 'password_hash'
    >,
    stored: ReturnType<EmailVerificationService['challenge']>['stored'],
  ): Promise<UserRecord> {
    const row = await this.persistence.transaction((state) => {
      const user = state.users.get(userId);
      if (!user || user.estado !== UserStatus.PENDIENTE)
        throw new ConflictException('Correo no disponible');
      Object.assign(user, changes);
      for (const token of state.verifications.values())
        if (token.id_usuario === userId && !token.consumed_at)
          token.consumed_at = stored.created_at;
      state.verifications.set(stored.token_hash, {
        ...stored,
        id_usuario: userId,
      });
      return user;
    });
    return adaptStoredUser(row);
  }

  confirm(token: string) {
    return this.persistence.transaction((state) => {
      const challenge = state.verifications.get(verificationHash(token));
      const user = challenge && state.users.get(challenge.id_usuario);
      if (!challenge || !user)
        throw new BadRequestException(
          'Enlace de verificacion invalido o vencido',
        );
      if (challenge.consumed_at && user.email_verificado_at)
        return { status: 'verified' as const, login_required: true as const };
      const now = new Date(Date.now());
      if (
        challenge.consumed_at ||
        challenge.expires_at <= now ||
        user.estado !== UserStatus.PENDIENTE
      )
        throw new BadRequestException(
          'Enlace de verificacion invalido o vencido',
        );
      activateAccount(
        state,
        user,
        this.policy.initialCredits ?? '',
        'correo',
        now,
      );
      return { status: 'verified' as const, login_required: true as const };
    });
  }

  verifyGoogle(userId: string, subject: string) {
    return this.persistence.transaction((state) => {
      const user = state.users.get(userId);
      if (!user) throw new BadRequestException('Cuenta no disponible');
      activateAccount(
        state,
        user,
        this.policy.initialCredits ?? '',
        'google',
        new Date(Date.now()),
        subject,
      );
    });
  }
}
