import { validateEnvironment } from './environment';

const secret = 'a'.repeat(64);

describe('Validacion de entorno', () => {
  it('usa puerto 4000 y mantiene la BD deshabilitada por defecto', () => {
    const config = validateEnvironment({ JWT_SECRET: secret });
    expect(config.PORT).toBe(4000);
    expect(config.DATABASE_ENABLED).toBe(false);
    expect(config.CORS_ORIGINS.split(',')).toContain(
      'http://127.0.0.1:5173',
    );
  });

  it('convierte numeros y booleanos de forma estricta', () => {
    const config = validateEnvironment({
      JWT_SECRET: secret,
      PORT: '4100',
      SWAGGER_ENABLED: 'false',
    });
    expect(config.PORT).toBe(4100);
    expect(config.SWAGGER_ENABLED).toBe(false);
  });

  it.each([
    { JWT_SECRET: '' },
    { JWT_SECRET: 'short' },
    { JWT_SECRET: 'change-me-'.repeat(10) },
    { PORT: 'abc' },
    { PORT: '65536' },
    { RATE_LIMIT_MAX: '0' },
    { DATABASE_ENABLED: 'yes' },
    { DATABASE_ENABLED: 'true' },
    { DATABASE_URL: 'https://example.test/db' },
    { CORS_ORIGINS: '*' },
    { CORS_ORIGINS: 'https://example.test/path' },
    { PERSISTENCE_MODE: 'prisma' },
    { NODE_ENV: 'production', PERSISTENCE_MODE: 'memory' },
  ])('rechaza configuracion invalida %j', (values) => {
    expect(() =>
      validateEnvironment({ JWT_SECRET: secret, ...values }),
    ).toThrow('Configuracion invalida');
  });

  it('no incluye valores sensibles en el error', () => {
    const value = 'postgresql://sensitive:private@';
    try {
      validateEnvironment({ JWT_SECRET: secret, DATABASE_URL: value });
      throw new Error('Se esperaba error');
    } catch (error) {
      expect(String(error)).toContain('DATABASE_URL');
      expect(String(error)).not.toContain(value);
    }
  });
});
