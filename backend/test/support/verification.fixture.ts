import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

/** Transporte de prueba explícito: no hace HTTP/SMTP ni crea una ruta pública de tokens. */
export function mailCapture() {
  return {
    assertConfigured: jest.fn(),
    send: jest
      .fn<Promise<void>, [string, string]>()
      .mockResolvedValue(undefined),
  };
}
export async function confirmFromMailbox(
  app: INestApplication,
  mailbox: ReturnType<typeof mailCapture>,
  correo: string,
) {
  const message = [...mailbox.send.mock.calls]
    .reverse()
    .find(([to]) => to === correo.trim().toLowerCase());
  if (!message) throw new Error('No verification email in test mailbox');
  await request(app.getHttpServer())
    .post('/auth/verify-email')
    .send({ token: message[1] })
    .expect(200);
}
