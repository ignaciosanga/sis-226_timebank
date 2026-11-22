import { BadRequestException } from '@nestjs/common';
import { types } from 'node:util';

/** Se conserva la cota técnica anterior hasta un acuerdo posterior de BD y PO. */
export const MAX_CREDITS = '2147483647';
/** Los números se admiten solo para fixtures enteros anteriores. */
export type CreditValue = string | number;
const MAX_TENTHS = 21_474_836_470n;
const QUARTER_HOUR_MS = 15 * 60 * 1_000;
const MAX_DURATION_MS = 8 * 60 * 60 * 1_000;

function tenths(value: CreditValue): bigint {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value))
      throw new BadRequestException(
        'Los créditos decimales deben enviarse como texto',
      );
    value = String(value);
  }
  if (typeof value !== 'string' || !/^-?\d+(?:\.\d0*)?$/.test(value))
    throw new BadRequestException(
      'Los créditos deben expresarse como texto con hasta una décima',
    );
  const negative = value.startsWith('-');
  const [whole, fraction = '0'] = (negative ? value.slice(1) : value).split(
    '.',
  );
  const scaled = BigInt(whole!) * 10n + BigInt(fraction[0]!);
  if (scaled > MAX_TENTHS)
    throw new BadRequestException(
      'El monto excede el límite técnico de créditos',
    );
  return negative ? -scaled : scaled;
}

function fromTenths(value: bigint): string {
  if (value > MAX_TENTHS || value < -MAX_TENTHS)
    throw new BadRequestException(
      'El monto excede el límite técnico de créditos',
    );
  const absolute = value < 0n ? -value : value;
  const whole = absolute / 10n;
  const fraction = absolute % 10n;
  return `${value < 0n ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

/** Entrada monetaria no negativa: formato HTTP estricto de enteros o décimas. */
export function parseCredits(value: string): string {
  if (typeof value !== 'string' || !/^\d+(?:\.\d)?$/.test(value))
    throw new BadRequestException(
      'Los créditos deben ser texto no negativo con hasta una décima',
    );
  return fromTenths(tenths(value));
}

/** Los ceros adicionales de un NUMERIC de BD se normalizan sin redondear. */
export function formatCredits(value: CreditValue): string {
  return fromTenths(tenths(value));
}

export function addCredits(left: CreditValue, right: CreditValue): string {
  return fromTenths(tenths(left) + tenths(right));
}

/** Permite responder un conflicto de negocio antes de ejecutar una suma inválida. */
export function wouldExceedCreditLimit(
  left: CreditValue,
  right: CreditValue,
): boolean {
  const total = tenths(left) + tenths(right);
  return total > MAX_TENTHS || total < -MAX_TENTHS;
}

export function subtractCredits(left: CreditValue, right: CreditValue): string {
  return fromTenths(tenths(left) - tenths(right));
}

export function compareCredits(left: CreditValue, right: CreditValue): number {
  const difference = tenths(left) - tenths(right);
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

export function isZeroCredits(value: CreditValue): boolean {
  return tenths(value) === 0n;
}

export function isWholeCredits(value: CreditValue): boolean {
  return tenths(value) % 10n === 0n;
}

/** Regla histórica para horarios que no pertenecen a una oferta. */
export function validateReservationInterval(start: Date, end: Date): void {
  if (
    !types.isDate(start) ||
    !types.isDate(end) ||
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime())
  )
    throw new BadRequestException('El intervalo contiene fechas invalidas');
  const duration = end.getTime() - start.getTime();
  if (
    duration <= 0 ||
    duration > MAX_DURATION_MS ||
    duration % QUARTER_HOUR_MS !== 0
  )
    throw new BadRequestException(
      'La reserva debe durar multiplos de 15 minutos, entre 15 minutos y 8 horas',
    );
}

export function reservationCost(start: Date, end: Date): string {
  validateReservationInterval(start, end);
  return String((end.getTime() - start.getTime()) / QUARTER_HOUR_MS);
}
