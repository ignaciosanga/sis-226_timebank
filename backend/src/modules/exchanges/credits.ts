import { BadRequestException } from '@nestjs/common';
import { types } from 'node:util';

/** Limite de INTEGER en PostgreSQL: los creditos oficiales son enteros. */
export const MAX_CREDITS = 2_147_483_647;
const QUARTER_HOUR_MS = 15 * 60 * 1_000;
const MAX_DURATION_MS = 8 * 60 * 60 * 1_000;

export function parseCredits(value: string): number {
  if (typeof value !== 'string' || !/^\d+$/.test(value))
    throw new BadRequestException(
      'Los creditos deben expresarse como un entero sin decimales',
    );
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount > MAX_CREDITS)
    throw new BadRequestException(
      'El monto excede el limite INTEGER de creditos',
    );
  return amount;
}

export function formatCredits(value: number): string {
  if (!Number.isInteger(value) || Math.abs(value) > MAX_CREDITS)
    throw new BadRequestException('Cantidad de creditos invalida');
  return String(value);
}

/** Unidad entera compatible con BD: un credito por cada 15 minutos. */
export function reservationCost(start: Date, end: Date): number {
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
  return duration / QUARTER_HOUR_MS;
}
