import {
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool, ClientBase } from 'pg';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { Environment } from '../../config/environment';
import type { PrismaClient } from '../../generated/prisma/client';

interface GeneratedClientModule {
  PrismaClient: new (options: { adapter: PrismaPg }) => PrismaClient;
}

@Injectable()
export class PrismaService implements OnModuleDestroy {
  creditDivisor = 1;
  private client?: PrismaClient;
  private connecting?: Promise<PrismaClient>;

  constructor(private readonly config: ConfigService<Environment, true>) {}

  /** Conexion compartida y diferida; /health/ready comprueba el destino real. */
  connect(): Promise<PrismaClient> {
    if (!this.config.get('DATABASE_ENABLED', { infer: true })) {
      return Promise.reject(
        new ServiceUnavailableException('Integracion PostgreSQL deshabilitada'),
      );
    }
    this.connecting ??= this.open().catch((error: unknown) => {
      this.connecting = undefined;
      throw error;
    });
    return this.connecting;
  }

  private async open(): Promise<PrismaClient> {
    let generated: GeneratedClientModule;
    try {
      // Carga diferida del cliente generado y compilado junto con la aplicacion.
      generated = createRequire(__filename)(
        resolve(__dirname, '../../generated/prisma/client'),
      ) as GeneratedClientModule;
      if (typeof generated.PrismaClient !== 'function') throw new Error();
    } catch {
      throw new ServiceUnavailableException(
        'Cliente Prisma no disponible; ejecutar prisma generate y compilar',
      );
    }
    const poolConfig = {
      connectionString: this.config.get('DATABASE_URL', { infer: true }),
      connectionTimeoutMillis: 5000,
      max: 10,
      idleTimeoutMillis: 30000,
      onConnect: async (connection: ClientBase) => {
        const key = this.config.get('APP_ENCRYPTION_KEY', { infer: true });
        const pepper = this.config.get('APP_HASH_PEPPER', { infer: true });
        if (key || pepper) {
          if (!key || !pepper)
            throw new ServiceUnavailableException(
              'Se requieren ambas claves criptográficas de BD',
            );
          await connection.query(
            "SELECT set_config('app.encryption_key',$1,false), set_config('app.hash_pepper',$2,false)",
            [key, pepper],
          );
        }
      },
    };
    const adapter = new PrismaPg(new Pool(poolConfig), {
      disposeExternalPool: true,
    });
    const client = new generated.PrismaClient({ adapter });
    try {
      await client.$connect();
      const [scale] = await client.$queryRawUnsafe<{ scaled: boolean }[]>(
        `SELECT to_regclass('public.config_economia') IS NOT NULL AND to_regclass('public."PENALIZACIONES_PENDIENTES"') IS NOT NULL AS scaled`,
      );
      this.creditDivisor = scale?.scaled ? 10 : 1;
      if (
        this.creditDivisor === 10 &&
        (!this.config.get('APP_ENCRYPTION_KEY', { infer: true }) ||
          !this.config.get('APP_HASH_PEPPER', { infer: true }))
      ) {
        throw new ServiceUnavailableException(
          'BD v4 requiere ambas claves criptográficas',
        );
      }
    } catch {
      await client.$disconnect().catch(() => undefined);
      throw new ServiceUnavailableException('PostgreSQL no disponible');
    }
    this.client = client;
    return client;
  }

  async onModuleDestroy(): Promise<void> {
    await this.connecting?.catch(() => undefined);
    await this.client?.$disconnect();
  }
}
