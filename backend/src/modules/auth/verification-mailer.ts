import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRequire } from 'node:module';
import { Environment } from '../../config/environment';

type MailMessage = { from: string; to: string; subject: string; text: string };
type SmtpTransport = { sendMail(message: MailMessage): Promise<unknown> };
const nodemailer = createRequire(__filename)('nodemailer') as {
  createTransport(options: Record<string, unknown>): SmtpTransport;
};

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

export function parseSender(from: string): { name?: string; email: string } {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  if (!match) return { email: from.trim() };
  const name = match[1]?.replace(/^"|"$/g, '').trim();
  return { ...(name ? { name } : {}), email: (match[2] ?? '').trim() };
}

@Injectable()
export class VerificationMailer {
  fetcher: typeof fetch = fetch;

  constructor(private readonly config: ConfigService<Environment, true>) {}

  assertConfigured(): void {
    const transport = this.config.get('MAIL_TRANSPORT', { infer: true });
    if (transport !== 'smtp' && transport !== 'brevo')
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
    const subject = 'Confirma tu cuenta institucional de Nexo U';
    const text = `Para activar la cuenta que registraste, abre este enlace y pulsa Confirmar:\n${url.href}\n\nEl enlace vence en ${config.get('EMAIL_VERIFICATION_TTL_MINUTES', { infer: true })} minutos. Si no solicitaste esta cuenta, ignora este correo. No compartas el enlace.`;
    if (config.get('MAIL_TRANSPORT', { infer: true }) === 'brevo')
      return this.sendWithBrevo(to, subject, text);
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
        subject,
        text,
      });
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo enviar el correo; solicita un nuevo enlace de verificacion',
      );
    }
  }

  private async sendWithBrevo(
    to: string,
    subject: string,
    text: string,
  ): Promise<void> {
    let response: Response;
    try {
      response = await this.fetcher(BREVO_URL, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'api-key': this.config.get('BREVO_API_KEY', { infer: true }) ?? '',
        },
        body: JSON.stringify({
          sender: parseSender(this.config.get('MAIL_FROM', { infer: true })),
          to: [{ email: to }],
          subject,
          textContent: text,
        }),
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      response = new Response(null, { status: 503 });
    }
    if (!response.ok)
      throw new ServiceUnavailableException(
        'No se pudo enviar el correo; solicita un nuevo enlace de verificacion',
      );
  }
}
