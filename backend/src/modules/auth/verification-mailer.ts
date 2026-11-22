import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRequire } from 'node:module';
import { Environment } from '../../config/environment';
import { verificationEmail } from './verification-email';

type MailMessage = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
};
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
    const mail = verificationEmail(
      url.href,
      config.get('EMAIL_VERIFICATION_TTL_MINUTES', { infer: true }),
    );
    if (config.get('MAIL_TRANSPORT', { infer: true }) === 'brevo')
      return this.sendWithBrevo(to, mail);
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
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo enviar el correo; solicita un nuevo enlace de verificacion',
      );
    }
  }

  private async sendWithBrevo(
    to: string,
    mail: ReturnType<typeof verificationEmail>,
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
          subject: mail.subject,
          textContent: mail.text,
          htmlContent: mail.html,
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
