import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import { Environment } from '../../config/environment';

@Injectable()
export class VerificationEmailService {
  private readonly transporter: Transporter | null;
  private readonly from: string | null;

  constructor(
    private readonly config: ConfigService<Environment, true>,
  ) {
    const host = config.get('SMTP_HOST', { infer: true });
    const port = config.get('SMTP_PORT', { infer: true });
    const secure = config.get('SMTP_SECURE', { infer: true });
    const user = config.get('SMTP_USER', { infer: true });
    const password = config.get('SMTP_PASSWORD', { infer: true });

    this.from = config.get('SMTP_FROM', { infer: true }) || null;

    if (!host || !this.from) {
      this.transporter = null;
      return;
    }

    this.transporter = createTransport({
      host,
      port,
      secure,
      ...(user && password
        ? {
            auth: {
              user,
              pass: password,
            },
          }
        : {}),
    });
  }

  async sendVerificationEmail(
    to: string,
    token: string,
  ): Promise<void> {
    if (!this.transporter || !this.from) {
      throw new ServiceUnavailableException(
        'El servicio de correo no está configurado',
      );
    }

    const frontendUrl = this.config.get('FRONTEND_URL', {
      infer: true,
    });

    const verificationUrl = new URL(frontendUrl);

    verificationUrl.hash =
      `/verificar-correo?token=${encodeURIComponent(token)}`;

    const link = verificationUrl.toString();

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Verifica tu correo - Banco de Tiempo',
      text: [
        'Hola:',
        '',
        'Para verificar tu correo electrónico, abre el siguiente enlace:',
        link,
        '',
        'Este enlace vence en 24 horas.',
        'Si no solicitaste esta cuenta, puedes ignorar este mensaje.',
      ].join('\n'),
      html: `
        <h2>Verifica tu correo electrónico</h2>
        <p>Para activar tu cuenta del Banco de Tiempo, utiliza el siguiente enlace:</p>
        <p><a href="${link}">Verificar mi correo</a></p>
        <p>Este enlace vence en 24 horas.</p>
        <p>Si no solicitaste esta cuenta, puedes ignorar este mensaje.</p>
      `,
    });
  }
}