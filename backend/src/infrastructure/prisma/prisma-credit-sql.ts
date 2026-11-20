import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import {
  CreditValue,
  formatCredits,
  isWholeCredits,
} from '../../modules/exchanges/credits';
import type {
  ExchangeRequest,
  Movement,
  Reservation,
} from '../../modules/exchanges/exchange.types';
import type { StoredUser } from '../../modules/users/user.types';

type Transaction = Prisma.TransactionClient;
export type CreditSchema = 'integer' | 'decimal';
type Column = readonly [name: string, type: string];

/** SQLSTATE estructurado: Prisma anterior o DriverAdapterError de Prisma 7. */
export function postgresErrorCode(error: unknown): string | undefined {
  const record = (value: unknown): Record<string, unknown> | undefined =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  const outer = record(error);
  if (outer?.code !== 'P2010') return undefined;
  const meta = record(outer.meta);
  const cause = record(record(meta?.driverAdapterError)?.cause);
  return [meta?.code, cause?.originalCode].find(
    (value): value is string =>
      typeof value === 'string' &&
      value.length === 5 &&
      /^[0-9A-Z]{5}$/.test(value),
  );
}

// Identificadores exclusivamente internos; los valores usan parametros separados.
const userColumns: readonly Column[] = [
  ['id_usuario', 'uuid'],
  ['nombre', 'text'],
  ['apellido', 'text'],
  ['correo', 'text'],
  ['password_hash', 'text'],
  ['rol', 'text'],
  ['id_carrera', 'uuid'],
  ['semestre', 'integer'],
  ['saldo', 'numeric'],
  ['creditos_retenidos', 'numeric'],
  ['fecha_registro', 'timestamptz'],
  ['ultimo_acceso', 'timestamptz'],
  ['estado', 'text'],
  ['cuenta_previa', 'boolean'],
  ['email_verificado_at', 'timestamptz'],
  ['metodo_verificacion', 'text'],
  ['bono_decidido_at', 'timestamptz'],
  ['google_sub', 'text'],
];
const requestColumns: readonly Column[] = [
  ['id_solicitud', 'uuid'],
  ['id_solicitante', 'uuid'],
  ['id_ofertante', 'uuid'],
  ['id_habilidad', 'uuid'],
  ['fecha_inicio_propuesta', 'timestamptz'],
  ['fecha_fin_propuesta', 'timestamptz'],
  ['creditos_requeridos', 'numeric'],
  ['estado', 'text'],
  ['created_at', 'timestamptz'],
  ['respondida_at', 'timestamptz'],
  ['id_oferta', 'uuid'],
];
const reservationColumns: readonly Column[] = [
  ['id_reserva', 'uuid'],
  ['id_solicitud', 'uuid'],
  ['id_solicitante', 'uuid'],
  ['id_ofertante', 'uuid'],
  ['id_habilidad', 'uuid'],
  ['fecha_inicio', 'timestamptz'],
  ['fecha_fin', 'timestamptz'],
  ['creditos', 'numeric'],
  ['modalidad', 'text'],
  ['lugar', 'text'],
  ['estado', 'text'],
  ['confirmacion_solicitante_at', 'timestamptz'],
  ['confirmacion_ofertante_at', 'timestamptz'],
  ['cancelado_por', 'uuid'],
  ['motivo_cancelacion', 'text'],
  ['horas_anticipacion_cancelacion', 'integer'],
  ['created_at', 'timestamptz'],
  ['completed_at', 'timestamptz'],
  ['cancelled_at', 'timestamptz'],
];
const movementColumns: readonly Column[] = [
  ['id_movimiento', 'uuid'],
  ['id_usuario', 'uuid'],
  ['id_reserva', 'uuid'],
  ['tipo', 'text'],
  ['cantidad', 'numeric'],
  ['saldo_anterior', 'numeric'],
  ['saldo_posterior', 'numeric'],
  ['retenidos_anterior', 'numeric'],
  ['retenidos_posterior', 'numeric'],
  ['created_at', 'timestamptz'],
  ['descripcion', 'text'],
];

/** Se comprueba dentro de cada snapshot; una bandera no puede habilitar decimales. */
export async function detectCreditSchema(
  tx: Transaction,
): Promise<CreditSchema> {
  const columns = await tx.$queryRawUnsafe<
    {
      table_name: string;
      column_name: string;
      udt_name: string;
      numeric_precision: number | null;
      numeric_scale: number | null;
    }[]
  >(`SELECT table_name, column_name, udt_name, numeric_precision, numeric_scale FROM information_schema.columns
     WHERE table_schema = 'public' AND (
       (table_name = 'USUARIOS' AND column_name IN ('saldo', 'creditos_retenidos')) OR
       (table_name = 'SOLICITUDES_INTERCAMBIO' AND column_name IN ('creditos_requeridos', 'id_oferta')) OR
       (table_name = 'RESERVAS' AND column_name = 'creditos') OR
       (table_name = 'MOVIMIENTOS_CREDITO' AND column_name IN
         ('cantidad', 'saldo_anterior', 'saldo_posterior', 'retenidos_anterior', 'retenidos_posterior'))
     )`);
  const monetary = columns.filter(
    (column) => column.column_name !== 'id_oferta',
  );
  if (
    monetary.length === 9 &&
    monetary.every((column) => column.udt_name === 'int4')
  )
    return 'integer';
  if (
    monetary.length === 9 &&
    monetary.every((column) => {
      if (column.udt_name !== 'numeric') return false;
      const precision = column.numeric_precision;
      const scale = column.numeric_scale;
      // NUMERIC sin typmod no redondea. Con typmod debe conservar al menos
      // una décima y diez dígitos enteros para la cota histórica 2147483647.
      return (
        (precision === null && scale === null) ||
        (typeof precision === 'number' &&
          Number.isInteger(precision) &&
          typeof scale === 'number' &&
          Number.isInteger(scale) &&
          scale >= 1 &&
          precision - scale >= 10)
      );
    }) &&
    columns.some(
      (column) =>
        column.table_name === 'SOLICITUDES_INTERCAMBIO' &&
        column.column_name === 'id_oferta' &&
        column.udt_name === 'uuid',
    )
  )
    return 'decimal';
  throw new ServiceUnavailableException(
    'Esquema de créditos incompatible: se requieren nueve INTEGER o nueve NUMERIC que conserven décimas y diez dígitos enteros, con referencia a oferta',
  );
}

function selectColumns(
  columns: readonly Column[],
  schema: CreditSchema,
): string {
  return columns
    .map(([name, type]) => {
      if (name === 'id_oferta' && schema === 'integer')
        return 'NULL::uuid AS "id_oferta"';
      return type === 'numeric' ? `"${name}"::text AS "${name}"` : `"${name}"`;
    })
    .join(', ');
}

/** Nunca dejar Decimal/Number fraccionario dentro de structuredClone del dominio. */
function normalize<T>(
  rows: Record<string, unknown>[],
  columns: readonly Column[],
): T[] {
  return rows.map((row) => {
    for (const [column, type] of columns)
      if (type === 'numeric') row[column] = formatCredits(String(row[column]));
    return row as T;
  });
}

export async function readCreditRows(tx: Transaction, schema: CreditSchema) {
  const rows = await Promise.all([
    tx.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT ${selectColumns(userColumns, schema)} FROM "USUARIOS"`,
    ),
    tx.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT ${selectColumns(requestColumns, schema)} FROM "SOLICITUDES_INTERCAMBIO"`,
    ),
    tx.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT ${selectColumns(reservationColumns, schema)} FROM "RESERVAS"`,
    ),
    tx.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT ${selectColumns(movementColumns, schema)} FROM "MOVIMIENTOS_CREDITO"`,
    ),
  ]);
  return {
    users: normalize<StoredUser>(rows[0], userColumns),
    requests: normalize<ExchangeRequest>(rows[1], requestColumns),
    reservations: normalize<Reservation>(rows[2], reservationColumns),
    movements: normalize<Movement>(rows[3], movementColumns),
  };
}

/** Unica conversion a Number: solo enteros ya comprobados dentro de la cota anterior. */
export function legacyCredit(value: CreditValue): number {
  const canonical = formatCredits(value);
  if (!isWholeCredits(canonical))
    throw new ConflictException({
      code: 'OFFER_PRICE_FLOW_PENDING',
      message: 'La base INTEGER no puede conservar el importe decimal',
    });
  const integer = Number(canonical);
  if (!Number.isSafeInteger(integer) || Math.abs(integer) > 2_147_483_647)
    throw new ConflictException(
      'El importe excede la capacidad del esquema INTEGER',
    );
  return integer;
}

async function insert(
  tx: Transaction,
  table:
    'USUARIOS' | 'SOLICITUDES_INTERCAMBIO' | 'RESERVAS' | 'MOVIMIENTOS_CREDITO',
  columns: readonly Column[],
  row: object,
  upsert: boolean,
): Promise<number> {
  const values = row as Record<string, unknown>;
  const parameters = columns.map(([name, type]) =>
    type === 'numeric'
      ? formatCredits(values[name] as CreditValue)
      : (values[name] ?? null),
  );
  const names = columns.map(([name]) => `"${name}"`).join(', ');
  const placeholders = columns
    .map(([, type], index) => `$${index + 1}::${type}`)
    .join(', ');
  const primaryKey = columns[0]![0];
  const conflict = upsert
    ? ` ON CONFLICT ("${primaryKey}") DO UPDATE SET ${columns
        .slice(1)
        .map(([name]) => `"${name}" = EXCLUDED."${name}"`)
        .join(', ')}`
    : '';
  return tx.$executeRawUnsafe(
    `INSERT INTO "${table}" (${names}) VALUES (${placeholders})${conflict}`,
    ...parameters,
  );
}

export const persistDecimalUser = (tx: Transaction, row: StoredUser) =>
  insert(
    tx,
    'USUARIOS',
    userColumns,
    { ...row, cuenta_previa: row.cuenta_previa ?? false },
    true,
  );
export const persistDecimalRequest = (tx: Transaction, row: ExchangeRequest) =>
  insert(tx, 'SOLICITUDES_INTERCAMBIO', requestColumns, row, true);
export const persistDecimalReservation = (tx: Transaction, row: Reservation) =>
  insert(tx, 'RESERVAS', reservationColumns, row, true);
export const persistDecimalMovement = (tx: Transaction, row: Movement) =>
  insert(tx, 'MOVIMIENTOS_CREDITO', movementColumns, row, false);
