import { fromTenths, toTenths } from './economy';

describe('Importes exactos del contrato BD v4', () => {
  it('convierte cobros negativos y cantidades fraccionarias sin redondear', () => {
    expect(fromTenths(-5)).toBe('-0.5');
    expect(toTenths('30.5')).toBe(305);
    expect(fromTenths(305)).toBe('30.5');
    expect(toTenths('-0.5')).toBe(-5);
    expect(fromTenths(0)).toBe('0');
  });
  it('rechaza overflow INTEGER antes de persistir', () => {
    expect(toTenths('214748364.7')).toBe(2147483647);
    expect(() => toTenths('214748364.8')).toThrow();
  });
  it('mantiene exactitud en sumas SQL mayores que el entero seguro JS', () => {
    expect(fromTenths('90071992547409931')).toBe('9007199254740993.1');
  });
});
