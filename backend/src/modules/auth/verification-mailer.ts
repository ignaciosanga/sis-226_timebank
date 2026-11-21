import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRequire } from 'node:module';
import { Environment } from '../../config/environment';

type MailMessage = { from: string; to: string; subject: string; text: string };
type SmtpTransport = { sendMail(message: MailMessage): Promise<unknown> };
const nodemailer = createRequire(__filename)('nodemailer') as {
  createTransport(options: Record<string, unknown>): SmtpTransport;
};

@Injectable()
export class VerificationMailer {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  assertConfigured(): void {
    if (this.config.get('MAIL_TRANSPORT', { infer: true }) !== 'smtp')
      throw new ServiceUnavailableException(
        'El correo de verificacion no esta configurado',
      );
  }

  async send(to: string, token: string): Promise<void> {
    this.assertConfigured();
    const config = this.config;
    const url = new URL(
      '/auth/verify-email',
      config.get('PUBLIC_API_URL', { infer: true }),
    );
    // Fragmento: la credencial no llega al servidor mediante GET ni al Referer.
    url.hash = new URLSearchParams({ token }).toString();
    const transport = nodemailer.createTransport({
      host: config.get('SMTP_HOST', { infer: true }),
      port: config.get('SMTP_PORT', { infer: true }),
      secure: config.get('SMTP_SECURE', { infer: true }),
      requireTLS: config.get('SMTP_REQUIRE_TLS', { infer: true }),
      ...(config.get('SMTP_USER', { infer: true })
        ? {
            auth: {
              user: config.get('SMTP_USER', { infer: true }),
              pass: config.get('SMTP_PASSWORD', { infer: true }),
            },
          }
        : {}),
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    try {
      await transport.sendMail({
        from: config.get('MAIL_FROM', { infer: true }),
        to,
        subject: 'Confirma tu cuenta institucional de Nexo U',
        text: `Para activar la cuenta que registraste, abre este enlace y pulsa Confirmar:\n${url.href}\n\nEl enlace vence en ${config.get('EMAIL_VERIFICATION_TTL_MINUTES', { infer: true })} minutos. Si no solicitaste esta cuenta, ignora este correo. No compartas el enlace.`,
      });
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo enviar el correo; solicita un nuevo enlace de verificacion',
      );
    }
  }
}
