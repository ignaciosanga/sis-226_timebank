import {
  MAX_CREDITS,
  parseCredits,
  formatCredits,
  reservationCost,
} from './credits';
describe('Creditos INTEGER del modelo optimizado', () => {
  it.each(['0', '1', '4', '2147483647'])(
    'convierte entero exacto %s',
    (value) => {
      expect(formatCredits(parseCredits(value))).toBe(value);
    },
  );
  it.each(['-1', '0.25', '1.00', '1e3', '', '2147483648', ' 1', 'NaN'])(
    'rechaza importe incompatible %s',
    (value) => {
      expect(() => parseCredits(value)).toThrow();
    },
  );
  it('limita al rango INTEGER PostgreSQL', () => {
    expect(MAX_CREDITS).toBe(2147483647);
  });
  it.each([15, 30, 60, 480])('calcula %i minutos sin redondear', (minutes) => {
    const start = new Date('2030-01-01T10:00:00Z');
    expect(
      reservationCost(start, new Date(start.getTime() + minutes * 60000)),
    ).toBe(minutes / 15);
  });
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
