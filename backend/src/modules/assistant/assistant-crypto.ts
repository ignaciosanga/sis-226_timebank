import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 'v1';

function keyFrom(secret: string): Buffer {
  const key = Buffer.from(secret, 'base64');
  if (key.length !== 32)
    throw new Error('ASSISTANT_KEYS_SECRET debe ser base64 de 32 bytes');
  return key;
}

export function encryptSecret(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(secret), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [
    VERSION,
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    data.toString('base64'),
  ].join(':');
}

export function decryptSecret(payload: string, secret: string): string {
  const [version, iv, tag, data] = payload.split(':');
  if (version !== VERSION || !iv || !tag || !data)
    throw new Error('Formato cifrado desconocido');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    keyFrom(secret),
    Buffer.from(iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(data, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export function keyHint(apiKey: string): string {
  return `${apiKey.slice(0, 4)}…${apiKey.slice(-4)}`;
}
