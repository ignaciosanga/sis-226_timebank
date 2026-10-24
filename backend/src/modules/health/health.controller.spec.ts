import { ConfigService } from '@nestjs/config';
import { Environment } from '../../config/environment';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { HealthController } from './health.controller';

describe('Readiness de persistencia', () => {
  const query = jest.fn();
  const connect = jest.fn();
  const controller = (mode: string) =>
    new HealthController(
      new ConfigService<Environment, true>({ PERSISTENCE_MODE: mode }),
      { connect } as unknown as PrismaService,
    );
  beforeEach(() => {
    query.mockReset();
    connect.mockReset().mockResolvedValue({ $queryRaw: query });
  });
  it('identifica memoria sin intentar conectar PostgreSQL', async () => {
    await expect(controller('memory').ready()).resolves.toEqual({
      status: 'ok',
      persistence: 'memory',
    });
    expect(connect).not.toHaveBeenCalled();
  });
  it('requiere las 12 tablas en PostgreSQL', async () => {
    query.mockResolvedValue([{ total: 12 }]);
    await expect(controller('prisma').ready()).resolves.toEqual({
      status: 'ok',
      persistence: 'postgresql',
    });
    query.mockResolvedValue([{ total: 11 }]);
    await expect(controller('prisma').ready()).rejects.toMatchObject({
      status: 503,
    });
  });
  it('devuelve 503 cuando se interrumpe la conexion', async () => {
    connect.mockRejectedValue(new Error('detalle privado de conexion'));
    await expect(controller('prisma').ready()).rejects.toMatchObject({
      status: 503,
      message: 'PostgreSQL o esquema no disponible',
    });
  });
});
