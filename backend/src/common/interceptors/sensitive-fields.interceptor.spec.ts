import { redactSensitiveFields } from './sensitive-fields.interceptor';

describe('Redaccion de respuestas con fechas', () => {
  it('conserva timestamps ISO incluso en fechas clonadas y elimina secretos anidados', () => {
    const response = structuredClone({
      fecha_inicio: new Date('2026-11-02T13:00:00Z'),
      password_hash: 'privado',
      nested: [{ passwordHash: 'privado', password: 'privado', nombre: 'Ana' }],
    });
    expect(redactSensitiveFields(response)).toEqual({
      fecha_inicio: '2026-11-02T13:00:00.000Z',
      nested: [{ nombre: 'Ana' }],
    });
  });
});
