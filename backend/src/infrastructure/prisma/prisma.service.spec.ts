import { ConfigService } from '@nestjs/config';
import { Environment } from '../../config/environment';
import { PrismaService } from './prisma.service';

describe('PrismaService sin conexion oficial', () => {
  it('no abre conexiones al construir o cerrar la aplicacion', async () => {
    const service = new PrismaService(
      new ConfigService<Environment, true>({ DATABASE_ENABLED: false }),
    );
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    await expect(service.connect()).rejects.toThrow('deshabilitada');
  });
});
