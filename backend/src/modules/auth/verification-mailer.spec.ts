import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Environment } from '../../config/environment';
import { parseSender, VerificationMailer } from './verification-mailer';

const settings: Partial<Environment> = {
  MAIL_TRANSPORT: 'brevo',
  BREVO_API_KEY: 'xkeysib-prueba',
  MAIL_FROM: 'Nexo U <nexo.u.ucb@gmail.com>',
  PUBLIC_API_URL: 'https://api.nexo.example',
  EMAIL_VERIFICATION_TTL_MINUTES: 60,
};
const mailer = (overrides: Partial<Environment> = {}) =>
  new VerificationMailer({
    get: (key: keyof Environment) => ({ ...settings, ...overrides })[key],
  } as unknown as ConfigService<Environment, true>);

describe('VerificationMailer con Brevo', () => {
  it('separa el nombre y el correo del remitente', () => {
    expect(parseSender('Nexo U <nexo@ucb.edu.bo>')).toEqual({
      name: 'Nexo U',
      email: 'nexo@ucb.edu.bo',
    });
    expect(parseSender('nexo@ucb.edu.bo')).toEqual({
      email: 'nexo@ucb.edu.bo',
    });
  });

  it('envía el enlace por HTTPS con la API key y el token solo en el fragmento', async () => {
    const service = mailer();
    const fetcher = jest.fn(async () => new Response('{}', { status: 201 }));
    service.fetcher = fetcher as unknown as typeof fetch;
    await service.send('ana@ucb.edu.bo', 'token-secreto');
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((init.headers as Record<string, string>)['api-key']).toBe(
      'xkeysib-prueba',
    );
    const body = JSON.parse(init.body as string) as {
      sender: unknown;
      to: unknown;
      textContent: string;
    };
    expect(body.sender).toEqual({
      name: 'Nexo U',
      email: 'nexo.u.ucb@gmail.com',
    });
    expect(body.to).toEqual([{ email: 'ana@ucb.edu.bo' }]);
    expect(body.textContent).toContain(
      'https://api.nexo.example/auth/verify-email#token=token-secreto',
    );
  });

  it('responde 503 si Brevo rechaza el envío o no responde', async () => {
    const rejected = mailer();
    rejected.fetcher = (async () =>
      new Response('{}', { status: 401 })) as unknown as typeof fetch;
    await expect(rejected.send('ana@ucb.edu.bo', 't')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    const offline = mailer();
    offline.fetcher = (async () => {
      throw new Error('timeout');
    }) as unknown as typeof fetch;
    await expect(offline.send('ana@ucb.edu.bo', 't')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('no envía nada si el correo está deshabilitado', async () => {
    const service = mailer({ MAIL_TRANSPORT: 'disabled' });
    const fetcher = jest.fn();
    service.fetcher = fetcher as unknown as typeof fetch;
    await expect(service.send('ana@ucb.edu.bo', 't')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});
