import { ConflictException } from '@nestjs/common';
import { compareCredits, CreditValue } from './credits';

export const CANCELLATION_NOTICE_MS = 5 * 60 * 60 * 1000;
export const CANCELLATION_PENALTY = '0.5';
export type CancellationClassification =
  'sin_multa' | 'injustificada' | 'administrativa';

export function classifyCancellation(
  administrator: boolean,
  start: Date,
  now: number,
): CancellationClassification {
  if (administrator) return 'administrativa';
  return start.getTime() - now < CANCELLATION_NOTICE_MS
    ? 'injustificada'
    : 'sin_multa';
}

/** Solo resuelve los casos independientes del orden de liberacion pendiente de BD. */
export function cancellationCharge(
  availableBeforeRelease: CreditValue,
  availableAfterRelease: CreditValue,
): 'Penalizacion' | 'penalizacion_sin_saldo' {
  const before =
    compareCredits(availableBeforeRelease, CANCELLATION_PENALTY) >= 0;
  const after =
    compareCredits(availableAfterRelease, CANCELLATION_PENALTY) >= 0;
  if (before !== after)
    throw new ConflictException({
      code: 'CANCELLATION_BALANCE_POLICY_PENDING',
      message:
        'BD debe confirmar si se evalua el disponible antes o despues de liberar. La reserva no fue modificada.',
    });
  return before ? 'Penalizacion' : 'penalizacion_sin_saldo';
}
