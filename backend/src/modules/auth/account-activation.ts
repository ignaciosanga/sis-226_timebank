import { ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { UserStatus } from '../../common/enums/record-status.enum';
import { ExchangeState } from '../exchanges/exchange.types';
import {
  addCredits,
  isZeroCredits,
  parseCredits,
  wouldExceedCreditLimit,
} from '../exchanges/credits';
import { StoredUser } from '../users/user.types';

/** Único escritor del bono; opera dentro del borrador de la transacción existente. */
export function grantWelcomeBonus(
  state: ExchangeState,
  user: StoredUser,
  amount: string,
  now: Date,
): void {
  if (user.cuenta_previa || user.bono_decidido_at) return;
  if (
    [...state.movements.values()].some(
      (m) => m.id_usuario === user.id_usuario && m.tipo === 'BonoInicial',
    )
  )
    throw new ConflictException(
      'La cuenta ya tiene un bono inicial sin decision registrada',
    );
  const value = parseCredits(amount);
  if (wouldExceedCreditLimit(user.saldo, value))
    throw new ConflictException('La cuenta excede el limite de creditos');
  user.bono_decidido_at = now; // También decide definitivamente un bono cero.
  if (isZeroCredits(value)) return;
  const id = randomUUID();
  state.movements.set(id, {
    id_movimiento: id,
    id_usuario: user.id_usuario,
    id_reserva: null,
    tipo: 'BonoInicial',
    cantidad: value,
    saldo_anterior: user.saldo,
    saldo_posterior: addCredits(user.saldo, value),
    retenidos_anterior: user.creditos_retenidos,
    retenidos_posterior: user.creditos_retenidos,
    created_at: now,
    descripcion: 'Bono de bienvenida al verificar la cuenta',
  });
  user.saldo = addCredits(user.saldo, value);
}

export function activateAccount(
  state: ExchangeState,
  user: StoredUser,
  amount: string,
  method: 'correo' | 'google',
  now: Date,
  googleSubject?: string,
): void {
  if (![UserStatus.PENDIENTE, UserStatus.ACTIVO].includes(user.estado))
    throw new ConflictException('La cuenta no permite activacion');
  if (googleSubject) {
    if (
      (user.google_sub && user.google_sub !== googleSubject) ||
      [...state.users.values()].some(
        (row) =>
          row.id_usuario !== user.id_usuario &&
          row.google_sub === googleSubject,
      )
    )
      throw new ConflictException(
        'Identidad de Google no disponible para esta cuenta',
      );
    user.google_sub = googleSubject;
  }
  if (user.estado === UserStatus.PENDIENTE) {
    grantWelcomeBonus(state, user, amount, now);
    // Una cuenta pendiente puede haber sido prerregistrada por otra persona.
    if (method === 'google') user.password_hash = '!google-only';
    user.estado = UserStatus.ACTIVO;
  }
  user.email_verificado_at ??= now;
  user.metodo_verificacion ??= method;
  for (const token of state.verifications.values())
    if (token.id_usuario === user.id_usuario && !token.consumed_at)
      token.consumed_at = now;
}
