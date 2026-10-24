import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  private dummyHash?: Promise<string>;

  hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  async verify(hash: string, password: string): Promise<boolean> {
    // Aceptar exclusivamente Argon2id; hashes heredados requieren una decision explicita.
    if (!hash.startsWith('$argon2id$')) return false;
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  async verifyOrDummy(
    hash: string | undefined,
    password: string,
  ): Promise<boolean> {
    if (hash) return this.verify(hash, password);
    this.dummyHash ??= this.hash(randomBytes(32).toString('hex'));
    await this.verify(await this.dummyHash, password);
    return false;
  }
}
