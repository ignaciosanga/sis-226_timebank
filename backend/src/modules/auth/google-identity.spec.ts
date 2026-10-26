import {
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyGoogleIdToken } from './google-identity';

const now = Date.parse('2026-10-25T22:00:00Z');
const valid = {
  aud: 'client-id',
  iss: 'https://accounts.google.com',
  email: 'Ana.Rojas@ucb.edu.bo',
  email_verified: 'true',
  exp: String(now / 1000 + 600),
  given_name: 'Ana',
  family_name: 'Rojas',
};
const respond = (body: object, ok = true) =>
  (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;

describe('verifyGoogleIdToken', () => {
  it('acepta una cuenta @ucb.edu.bo verificada y normaliza el correo', async () => {
    await expect(
      verifyGoogleIdToken('token', 'client-id', respond(valid), now),
    ).resolves.toEqual({
      correo: 'ana.rojas@ucb.edu.bo',
      nombre: 'Ana',
      apellido: 'Rojas',
    });
  });

  it('rechaza tokens emitidos para otro cliente', async () => {
    await expect(
      verifyGoogleIdToken(
        'token',
        'client-id',
        respond({ ...valid, aud: 'otro' }),
        now,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza correos fuera de @ucb.edu.bo', async () => {
    await expect(
      verifyGoogleIdToken(
        'token',
        'client-id',
        respond({ ...valid, email: 'ana@gmail.com' }),
        now,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza correos no verificados y tokens expirados', async () => {
    await expect(
      verifyGoogleIdToken(
        'token',
        'client-id',
        respond({ ...valid, email_verified: 'false' }),
        now,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      verifyGoogleIdToken(
        'token',
        'client-id',
        respond({ ...valid, exp: String(now / 1000 - 1) }),
        now,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza respuestas inválidas de Google y fallas de red', async () => {
    await expect(
      verifyGoogleIdToken('token', 'client-id', respond({}, false), now),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    const offline = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    await expect(
      verifyGoogleIdToken('token', 'client-id', offline, now),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
