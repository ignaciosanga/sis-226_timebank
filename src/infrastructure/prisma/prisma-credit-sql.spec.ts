import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import type { Movement } from '../../modules/exchanges/exchange.types';
import {
  detectCreditSchema,
  legacyCredit,
  persistDecimalMovement,
  postgresErrorCode,
  readCreditRows,
} from './prisma-credit-sql';

const monetaryColumns = [
  ['USUARIOS', 'saldo'],
  ['USUARIOS', 'creditos_retenidos'],
  ['SOLICITUDES_INTERCAMBIO', 'creditos_requeridos'],
  ['RESERVAS', 'creditos'],
  ['MOVIMIENTOS_CREDITO', 'cantidad'],
  ['MOVIMIENTOS_CREDITO', 'saldo_anterior'],
  ['MOVIMIENTOS_CREDITO', 'saldo_posterior'],
  ['MOVIMIENTOS_CREDITO', 'retenidos_anterior'],
  ['MOVIMIENTOS_CREDITO', 'retenidos_posterior'],
];
const columns = (
  type: string,
  precision: number | null = null,
  scale: number | null = null,
) =>
  monetaryColumns.map(([table_name, column_name]) => ({
    table_name,
    column_name,
    udt_name: type,
    numeric_precision: precision,
    numeric_scale: scale,
  }));
const offerReference = {
  table_name: 'SOLICITUDES_INTERCAMBIO',
  column_name: 'id_oferta',
  udt_name: 'uuid',
  numeric_precision: null,
  numeric_scale: null,
};
const transaction = (rows: unknown) =>
  ({
    $queryRawUnsafe: jest.fn().mockResolvedValue(rows),
  }) as unknown as Prisma.TransactionClient;

describe('Adaptacion segura de creditos PostgreSQL', () => {
  it.each(['23503', '23505', '40001', '40P01'])(
    'extrae SQLSTATE %s de Prisma anterior y Prisma 7 sin consultar mensajes',
    (code) => {
      expect(postgresErrorCode({ code: 'P2010', meta: { code } })).toBe(code);
      expect(
        postgresErrorCode({
          code: 'P2010',
          meta: {
            driverAdapterError: { cause: { originalCode: code } },
          },
        }),
      ).toBe(code);
    },
  );

  it('utiliza la causa estructurada si meta.code no contiene SQLSTATE', () => {
    expect(
      postgresErrorCode({
        code: 'P2010',
        meta: {
          code: 'N/A',
          driverAdapterError: { cause: { originalCode: '23503' } },
        },
      }),
    ).toBe('23503');
  });

  it.each([
    undefined,
    null,
    '23503',
    { code: 'P2003', meta: { code: '23503' } },
    { code: 'P2010' },
    { code: 'P2010', meta: [] },
    { code: 'P2010', meta: { code: 23503 } },
    { code: 'P2010', meta: { code: '23503\n' } },
    { code: 'P2010', meta: { code: '40p01' } },
    { code: 'P2010', meta: { driverAdapterError: { cause: '23503' } } },
    {
      code: 'P2010',
      meta: { driverAdapterError: { cause: { originalCode: 23503 } } },
    },
    {
      code: 'P2010',
      message: '23503',
      meta: { driverAdapterError: { cause: { originalMessage: '23503' } } },
    },
  ])('ignora mensajes y estructuras sin SQLSTATE valido: %#', (error) => {
    expect(postgresErrorCode(error)).toBeUndefined();
  });

  it('mantiene el camino entero con los nueve campos originales', async () => {
    await expect(
      detectCreditSchema(transaction(columns('int4'))),
    ).resolves.toBe('integer');
  });

  it('habilita decimal solo con los nueve numeric y la referencia UUID', async () => {
    const metadata = [...columns('numeric'), offerReference];
    await expect(detectCreditSchema(transaction(metadata))).resolves.toBe(
      'decimal',
    );
    await expect(
      detectCreditSchema(transaction(columns('numeric'))),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rechaza una conversion parcial o columnas faltantes', async () => {
    const mixed = [...columns('numeric'), offerReference];
    mixed[0]!.udt_name = 'int4';
    await expect(detectCreditSchema(transaction(mixed))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(
      detectCreditSchema(transaction(columns('int4').slice(1))),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it.each([
    [11, 1],
    [12, 2],
    [40, 10],
  ])(
    'admite NUMERIC(%i,%i) sin pérdida de décimas ni capacidad histórica',
    async (precision, scale) => {
      await expect(
        detectCreditSchema(
          transaction([
            ...columns('numeric', precision, scale),
            offerReference,
          ]),
        ),
      ).resolves.toBe('decimal');
    },
  );

  it.each([
    [10, 0],
    [12, -1],
    [10, 1],
    [12, 3],
  ])(
    'rechaza NUMERIC(%i,%i) que redondea o reduce la capacidad histórica',
    async (precision, scale) => {
      await expect(
        detectCreditSchema(
          transaction([
            ...columns('numeric', precision, scale),
            offerReference,
          ]),
        ),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    },
  );

  it('rechaza un único campo redondeador aunque los otros ocho sean compatibles', async () => {
    const metadata = [...columns('numeric', 11, 1), offerReference];
    metadata[0]!.numeric_scale = 0;
    await expect(
      detectCreditSchema(transaction(metadata)),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('normaliza los nueve importes antes de devolver filas al dominio', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ saldo: '10.00', creditos_retenidos: '3.700' }])
      .mockResolvedValueOnce([
        { creditos_requeridos: '3.70', id_oferta: 'offer-id' },
      ])
      .mockResolvedValueOnce([{ creditos: '3.7' }])
      .mockResolvedValueOnce([
        {
          cantidad: '3.70',
          saldo_anterior: '10.0',
          saldo_posterior: '10',
          retenidos_anterior: '0.0',
          retenidos_posterior: '3.700',
        },
      ]);
    const result = await readCreditRows(
      { $queryRawUnsafe: query } as unknown as Prisma.TransactionClient,
      'decimal',
    );
    expect(structuredClone(result)).toEqual({
      users: [{ saldo: '10', creditos_retenidos: '3.7' }],
      requests: [{ creditos_requeridos: '3.7', id_oferta: 'offer-id' }],
      reservations: [{ creditos: '3.7' }],
      movements: [
        {
          cantidad: '3.7',
          saldo_anterior: '10',
          saldo_posterior: '10',
          retenidos_anterior: '0',
          retenidos_posterior: '3.7',
        },
      ],
    });
  });

  it('escribe la fraccion como parametro textual, conservando texto ajeno al SQL', async () => {
    const execute = jest.fn().mockResolvedValue(1);
    const description = "Tutor's class; DROP TABLE USUARIOS;";
    const row: Movement = {
      id_movimiento: '00000000-0000-4000-8000-000000000001',
      id_usuario: '00000000-0000-4000-8000-000000000002',
      id_reserva: null,
      tipo: 'Retencion',
      cantidad: '3.7',
      saldo_anterior: '10',
      saldo_posterior: '10',
      retenidos_anterior: '0',
      retenidos_posterior: '3.7',
      created_at: new Date(),
      descripcion: description,
    };
    await persistDecimalMovement(
      { $executeRawUnsafe: execute } as unknown as Prisma.TransactionClient,
      row,
    );
    const [sql, ...values] = execute.mock.calls[0] as [string, ...unknown[]];
    expect(sql).not.toContain(description);
    expect(sql).toContain('$5::numeric');
    expect(values[4]).toBe('3.7');
    expect(values[8]).toBe('3.7');
    expect(values[10]).toBe(description);
  });

  it('impide que el escritor INTEGER trunque un importe decimal', () => {
    expect(legacyCredit('3.0')).toBe(3);
    expect(legacyCredit('2147483647')).toBe(2147483647);
    expect(() => legacyCredit('3.7')).toThrow(ConflictException);
  });
});
