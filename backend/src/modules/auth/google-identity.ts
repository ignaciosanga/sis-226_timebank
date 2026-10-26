import {
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

export interface GoogleIdentity {
  correo: string;
  nombre: string;
  apellido: string;
}

type TokenInfo = {
  aud?: string;
  iss?: string;
  email?: string;
  email_verified?: string | boolean;
  exp?: string | number;
  given_name?: string;
  family_name?: string;
};

const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
const UCB_EMAIL = /^[^@\s]+@ucb\.edu\.bo$/;

export async function verifyGoogleIdToken(
  credential: string,
  clientId: string,
  fetcher: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<GoogleIdentity> {
  let response: Response;
  try {
    response = await fetcher(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
    );
  } catch {
    throw new ServiceUnavailableException(
      'No se pudo verificar la cuenta de Google',
    );
  }
  if (!response.ok)
    throw new UnauthorizedException('La sesión de Google no es válida');
  const info = (await response.json()) as TokenInfo;
  if (info.aud !== clientId || !ISSUERS.includes(info.iss ?? ''))
    throw new UnauthorizedException('La sesión de Google no es válida');
  if (!info.exp || Number(info.exp) * 1000 <= now)
    throw new UnauthorizedException('La sesión de Google expiró');
  if (info.email_verified !== true && info.email_verified !== 'true')
    throw new UnauthorizedException('Google no verificó este correo');
  const correo = String(info.email ?? '')
    .trim()
    .toLowerCase();
  if (!UCB_EMAIL.test(correo))
    throw new ForbiddenException('Solo se permiten cuentas @ucb.edu.bo');
  const usuario = correo.split('@')[0]!;
  return {
    correo,
    nombre: info.given_name?.trim() || usuario,
    apellido: info.family_name?.trim() || usuario,
  };
}
