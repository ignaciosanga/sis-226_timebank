import {
  MAX_CREDITS,
  parseCredits,
  formatCredits,
  reservationCost,
  addCredits,
  subtractCredits,
  compareCredits,
  isZeroCredits,
  isWholeCredits,
  wouldExceedCreditLimit,
} from './credits';

describe('Créditos exactos con política de décimas', () => {
  it.each(['0', '1', '3.7', '2147483646.9', '2147483647'])(
    'conserva el importe exacto %s',
    (value) => {
      expect(formatCredits(parseCredits(value))).toBe(value);
    },
  );
  it.each(['-1', '0.25', '1.00', '1e3', '', '2147483647.1', ' 1', 'NaN'])(
    'rechaza importe incompatible %s',
    (value) => {
      expect(() => parseCredits(value)).toThrow();
    },
  );
  it('mantiene la cota técnica histórica sin ampliarla', () => {
    expect(MAX_CREDITS).toBe('2147483647');
    expect(() => addCredits(MAX_CREDITS, '0.1')).toThrow();
    expect(wouldExceedCreditLimit(MAX_CREDITS, '0.1')).toBe(true);
    expect(wouldExceedCreditLimit('2147483646.9', '0.1')).toBe(false);
  });
  it('normaliza enteros, signos y ceros de NUMERIC sin pasar por Number', () => {
    expect(parseCredits('003.0')).toBe('3');
    expect(formatCredits('-0.0')).toBe('0');
    expect(formatCredits('3.700')).toBe('3.7');
    expect(formatCredits(2147483647)).toBe('2147483647');
    expect(() => formatCredits(3.7)).toThrow();
    expect(() => formatCredits('3.71')).toThrow();
  });
  it('retiene y libera 3.7 exactamente desde un saldo de 10', () => {
    const held = addCredits('0', '3.7');
    expect(held).toBe('3.7');
    expect(subtractCredits('10', held)).toBe('6.3');
    expect(subtractCredits(held, '3.7')).toBe('0');
    expect(addCredits('0.1', '0.2')).toBe('0.3');
    expect(compareCredits('3.7', '3.8')).toBe(-1);
    expect(compareCredits('10', '9.9')).toBe(1);
    expect(compareCredits('3.0', 3)).toBe(0);
    expect(isZeroCredits('0.0')).toBe(true);
    expect(isWholeCredits('3.0')).toBe(true);
    expect(isWholeCredits('3.7')).toBe(false);
  });
  it('conserva el signo de consumos sin truncar la fracción', () => {
    expect(subtractCredits('0', '3.7')).toBe('-3.7');
    expect(addCredits('-3.7', '3.7')).toBe('0');
  });
  it.each([15, 30, 45, 60, 480])(
    'calcula %i minutos históricos sin redondear',
    (minutes) => {
      const start = new Date('2030-01-01T10:00:00Z');
      expect(
        reservationCost(start, new Date(start.getTime() + minutes * 60000)),
      ).toBe(String(minutes / 15));
    },
  );
  it.each([-15, 0, 14, 16, 481])('rechaza duracion %i', (minutes) => {
    const start = new Date('2030-01-01T10:00:00Z');
    expect(() =>
      reservationCost(start, new Date(start.getTime() + minutes * 60000)),
    ).toThrow();
  });
  it('rechaza fechas imposibles', () => {
    expect(() => reservationCost(new Date('invalid'), new Date())).toThrow();
  });
});
