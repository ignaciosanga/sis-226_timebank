import { validateEnvironment } from './environment';

const secret = 'a'.repeat(64);

describe('Validacion de entorno', () => {
  it('usa puerto 4000 y mantiene la BD deshabilitada por defecto', () => {
    const config = validateEnvironment({ JWT_SECRET: secret });
    expect(config.PORT).toBe(4000);
    expect(config.DATABASE_ENABLED).toBe(false);
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
    { GOOGLE_CALENDAR_ENABLED: 'true' },
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

  it('requiere la configuracion completa al habilitar Google Calendar', () => {
    const config = validateEnvironment({
      JWT_SECRET: secret,
      GOOGLE_CALENDAR_ENABLED: 'true',
      GOOGLE_CALENDAR_CLIENT_ID: 'client-id',
      GOOGLE_CALENDAR_CLIENT_SECRET: 'client-secret',
      GOOGLE_CALENDAR_REDIRECT_URI: 'http://localhost:4000/calendar/callback',
    });
    expect(config.GOOGLE_CALENDAR_ENABLED).toBe(true);
  });
});
