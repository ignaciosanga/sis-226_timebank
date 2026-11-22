import { BadRequestException } from '@nestjs/common';

/** Política local provisional: entero o una décima, hasta diez dígitos enteros. */
export const OFFER_PRICE_PATTERN = /^(0|[1-9][0-9]{0,9})(\.[0-9])?$/;
export const OFFER_PRICE_TECHNICAL_MAX = '9999999999.9';

export function parseOfferPrice(value: unknown): string {
  if (typeof value !== 'string' || !OFFER_PRICE_PATTERN.test(value))
    throw new BadRequestException(
      'costoCreditos debe ser texto decimal positivo con enteros o una decima; maximo tecnico 9999999999.9',
    );
  if (value === '0' || value === '0.0')
    throw new BadRequestException('costoCreditos debe ser mayor que cero');
  return value.endsWith('.0') ? value.slice(0, -2) : value;
}
