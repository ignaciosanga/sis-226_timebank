import {
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { Environment } from '../../config/environment';

interface PrismaLifecycle {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
}
interface GeneratedClientModule {
  PrismaClient: new (options: { adapter: PrismaPg }) => PrismaLifecycle;
}

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private client?: PrismaLifecycle;
  private connecting?: Promise<PrismaLifecycle>;

  constructor(private readonly config: ConfigService<Environment, true>) {}

  /** Conexion diferida: /health nunca abre una conexion a PostgreSQL.
   * Tras la introspeccion, sustituir este limite de ciclo de vida por el tipo
   * generado en los repositorios oficiales y vincular USERS_REPOSITORY.
   */
  connect(): Promise<PrismaLifecycle> {
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

  private async open(): Promise<PrismaLifecycle> {
    let generated: GeneratedClientModule;
    try {
      // Carga diferida para compilar sin inventar modelos cuando falta el esquema.
      generated = createRequire(__filename)(
        resolve(__dirname, '../../generated/prisma/client'),
      ) as GeneratedClientModule;
      if (typeof generated.PrismaClient !== 'function') throw new Error();
    } catch {
      throw new ServiceUnavailableException(
        'Cliente Prisma oficial pendiente de generacion',
      );
    }
    const adapter = new PrismaPg({
      connectionString: this.config.get('DATABASE_URL', { infer: true }),
      connectionTimeoutMillis: 5000,
      max: 10,
      idleTimeoutMillis: 30000,
    });
    const client = new generated.PrismaClient({ adapter });
    try {
      await client.$connect();
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
