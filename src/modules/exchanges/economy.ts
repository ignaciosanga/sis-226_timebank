import { ConflictException } from '@nestjs/common';
import { ExchangeState } from './exchange.types';
import { formatCredits } from './credits';

/** Contrato BD v4: INTEGER representa décimas; conversión exacta sin flotantes. */
export function fromTenths(value: string | number): string {
  const n = BigInt(value),
    sign = n < 0n ? '-' : '',
    abs = n < 0n ? -n : n;
  return `${sign}${abs / 10n}${abs % 10n ? `.${abs % 10n}` : ''}`;
}
export function toTenths(value: string | number): number {
  const text = formatCredits(value);
  const negative = text.startsWith('-');
  const [whole, fraction = '0'] = text.replace('-', '').split('.');
  const amount =
    (BigInt(whole!) * 10n + BigInt(fraction)) * (negative ? -1n : 1n);
  if (amount < -2147483648n || amount > 2147483647n)
    throw new ConflictException(
      'Importe fuera de capacidad INTEGER en décimas',
    );
  return Number(amount);
}

/** Replica la función entregada por BD: importes ADITIVOS, no multiplicadores. */
export function dynamicCost(
  state: ExchangeState,
  skill: string,
  tutor: string,
  start: Date,
): string {
  const c = state.economy;
  if (!c)
    throw new ConflictException('Configuración económica BD no disponible');
  const students = new Set(
    [...state.userSkills.values()]
      .filter(
        (s) =>
          s.id_habilidad === skill &&
          state.users.get(s.id_usuario)?.estado === 'Activo' &&
          state.users.get(s.id_usuario)?.rol === 'Estudiante',
      )
      .map((s) => s.id_usuario),
  );
  if (!students.has(tutor))
    throw new ConflictException(
      'La economía BD requiere ofertante estudiante activo con la habilidad',
    );
  let price = c.costo_base!;
  if (students.size < c.umbral_tutores_escasez!) price += c.mult_escasez!;
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/La_Paz',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(start),
  );
  if (hour >= 18 && hour <= 21) price += c.mult_demanda!;
  const ratings = [...state.ratings.values()].filter(
    (r) => r.id_evaluado === tutor,
  );
  if (
    ratings.length &&
    ratings.reduce((n, r) => n + r.puntuacion, 0) / ratings.length > 4.5
  )
    price += c.mult_impacto!;
  if (!Number.isSafeInteger(price) || price > 2147483647)
    throw new ConflictException('Configuración económica fuera de rango');
  return fromTenths(Math.max(1, price));
}
