import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AnalyticsRepository } from './analytics.repository';

describe('Analytics: agregados exactos de créditos', () => {
  const query = jest.fn();
  const repository = new AnalyticsRepository(
    {
      connect: jest.fn().mockResolvedValue({ $queryRawUnsafe: query }),
    } as unknown as PrismaService,
    { get: jest.fn().mockReturnValue('prisma') } as unknown as ConfigService,
  );
  const period = {
    from: new Date('2030-01-01T00:00:00Z'),
    to: new Date('2030-02-01T00:00:00Z'),
  };
  beforeEach(() => query.mockReset());

  it('conserva décimas y totales superiores al límite individual', async () => {
    query.mockResolvedValue([{ saldo: '4294967294.0', retenidos: '3.700' }]);
    await expect(repository.currentBalances()).resolves.toEqual({
      saldo: '4294967294',
      retenidos: '3.7',
    });
    expect(query.mock.calls[0]![0]).toContain('SUM("saldo")::text');
  });
  it('conserva el signo de los consumos y contadores separados', async () => {
    query.mockResolvedValue([
      { tipo: 'Consumo', cantidad: 2n, creditos: '-7.4' },
    ]);
    await expect(repository.movementsByType(period)).resolves.toEqual({
      Consumo: { cantidad: 2, creditos: '-7.4' },
    });
  });
  it('conserva créditos decimales en la serie y en completadas', async () => {
    query.mockResolvedValueOnce([
      { periodo: period.from, cantidad: 1n, creditos: '3.7' },
    ]);
    await expect(repository.completedSeries(period, 'day')).resolves.toEqual([
      { periodo: period.from.toISOString(), cantidad: 1, creditos: '3.7' },
    ]);
    query.mockResolvedValueOnce([
      { cantidad: 1n, minutos: 45, creditos: '3.7' },
    ]);
    await expect(repository.completedReservations(period)).resolves.toEqual({
      cantidad: 1,
      minutos: 45,
      creditos: '3.7',
    });
  });
  it('representa SUM vacío como cero', async () => {
    query.mockResolvedValue([{ saldo: null, retenidos: null }]);
    await expect(repository.currentBalances()).resolves.toEqual({
      saldo: '0',
      retenidos: '0',
    });
  });
  it('rechaza precisión adicional sin truncar ni redondear', async () => {
    query.mockResolvedValue([{ saldo: '3.71', retenidos: '0' }]);
    await expect(repository.currentBalances()).rejects.toThrow(
      'política de décimas',
    );
  });
});
