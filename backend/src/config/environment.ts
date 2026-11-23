import { plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export class Environment {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV = 'development';

  @IsIn(['memory', 'prisma'])
  PERSISTENCE_MODE = 'memory';

  @IsInt()
  @Min(0)
  @Max(2147483647)
  REGISTRATION_INITIAL_CREDITS = 8;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 4000;

  @IsString()
  CORS_ORIGINS =
    'http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173';

  @IsInt()
  @Min(1)
  RATE_LIMIT_TTL_MS = 60000;

  @IsInt()
  @Min(1)
  RATE_LIMIT_MAX = 100;

  @IsString()
  @MinLength(32)
  JWT_SECRET!: string;

  @IsInt()
  @Min(1)
  @Max(86400)
  JWT_EXPIRES_IN_SECONDS = 900;

  @IsString()
  @MinLength(1)
  JWT_ISSUER = 'banco-tiempo-backend';

  @IsString()
  @MinLength(1)
  JWT_AUDIENCE = 'banco-tiempo-clients';

  @IsOptional()
  @IsString()
  DATABASE_URL?: string;

  @IsBoolean()
  DATABASE_ENABLED = false;

  @IsBoolean()
  SWAGGER_ENABLED = true;

  @IsIn(['disabled', 'smtp', 'brevo'])
  MAIL_TRANSPORT = 'disabled';
  @IsOptional()
  @IsString()
  BREVO_API_KEY?: string;
  @IsString()
  PUBLIC_API_URL = 'http://localhost:4000';
  @IsString()
  SMTP_HOST = '127.0.0.1';
  @IsInt()
  @Min(1)
  @Max(65535)
  SMTP_PORT = 1025;
  @IsBoolean()
  SMTP_SECURE = false;
  @IsBoolean()
  SMTP_REQUIRE_TLS = true;
  @IsOptional()
  @IsString()
  SMTP_USER?: string;
  @IsOptional()
  @IsString()
  SMTP_PASSWORD?: string;
  @IsString()
  MAIL_FROM = 'Nexo U <no-reply@nexo-u.local>';
  @IsInt()
  @Min(1)
  @Max(1440)
  EMAIL_VERIFICATION_TTL_MINUTES = 60;

  @IsString()
  @MinLength(1)
  BANNER_STORAGE_DIR = '.local/tutoring-banners';

  @IsBoolean()
  GOOGLE_CALENDAR_ENABLED = false;

  @IsOptional()
  @IsString()
  GOOGLE_CALENDAR_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  GOOGLE_CALENDAR_CLIENT_SECRET?: string;

  @IsOptional()
  @IsString()
  GOOGLE_LOGIN_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  GOOGLE_CALENDAR_REDIRECT_URI?: string;

  @IsString()
  FRONTEND_URL = 'http://localhost:5173';

  @IsOptional()
  @IsString()
  ASSISTANT_API_KEY?: string;

  @IsString()
  ASSISTANT_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

  @IsString()
  @MinLength(1)
  ASSISTANT_MODEL = 'llama-3.3-70b-versatile';

  @IsInt()
  @Min(1000)
  @Max(60000)
  ASSISTANT_TIMEOUT_MS = 15000;

  @IsOptional()
  @IsString()
  ASSISTANT_KEYS_SECRET?: string;

  @IsInt()
  @Min(0)
  @Max(1000)
  ASSISTANT_FREE_MESSAGES = 5;
}

export function validateEnvironment(
  input: Record<string, unknown>,
): Environment {
  const parsed = { ...input };
  for (const key of [
    'PORT',
    'RATE_LIMIT_TTL_MS',
    'RATE_LIMIT_MAX',
    'JWT_EXPIRES_IN_SECONDS',
    'REGISTRATION_INITIAL_CREDITS',
    'SMTP_PORT',
    'EMAIL_VERIFICATION_TTL_MINUTES',
    'ASSISTANT_TIMEOUT_MS',
    'ASSISTANT_FREE_MESSAGES',
  ]) {
    if (input[key] !== undefined) parsed[key] = Number(input[key]);
  }
  for (const key of [
    'DATABASE_ENABLED',
    'SWAGGER_ENABLED',
    'GOOGLE_CALENDAR_ENABLED',
    'SMTP_SECURE',
    'SMTP_REQUIRE_TLS',
  ]) {
    if (input[key] === 'true') parsed[key] = true;
    else if (input[key] === 'false') parsed[key] = false;
  }
  const config = plainToInstance(Environment, parsed);
  const errors = validateSync(config, {
    validationError: { target: false, value: false },
  });
  if (errors.length)
    throw new Error(
      `Configuracion invalida: ${errors.map((e) => e.property).join(', ')}`,
    );
  if (config.NODE_ENV === 'production' && config.PERSISTENCE_MODE === 'memory')
    throw new Error(
      'Configuracion invalida: PERSISTENCE_MODE memory solo admite desarrollo y pruebas',
    );
  if (
    config.PERSISTENCE_MODE === 'prisma' &&
    (!config.DATABASE_ENABLED || !config.DATABASE_URL)
  )
    throw new Error(
      'Configuracion invalida: prisma requiere DATABASE_ENABLED y DATABASE_URL',
    );
  const origins = config.CORS_ORIGINS.split(',').map((value) => value.trim());
  if (
    !origins.length ||
    origins.some((origin) => {
      try {
        const url = new URL(origin);
        return (
          !['http:', 'https:'].includes(url.protocol) || url.origin !== origin
        );
      } catch {
        return true;
      }
    })
  )
    throw new Error('Configuracion invalida: CORS_ORIGINS');
  if (config.DATABASE_URL) {
    try {
      const url = new URL(config.DATABASE_URL);
      if (
        !['postgres:', 'postgresql:'].includes(url.protocol) ||
        !url.hostname ||
        url.pathname.length < 2
      )
        throw new Error();
    } catch {
      throw new Error('Configuracion invalida: DATABASE_URL');
    }
  }
  if (config.DATABASE_ENABLED && !config.DATABASE_URL)
    throw new Error('Configuracion invalida: DATABASE_URL requerida');
  if (config.GOOGLE_CALENDAR_ENABLED) {
    if (
      !config.GOOGLE_CALENDAR_CLIENT_ID ||
      !config.GOOGLE_CALENDAR_CLIENT_SECRET ||
      !config.GOOGLE_CALENDAR_REDIRECT_URI
    )
      throw new Error('Configuracion invalida: Google Calendar');
  }
  for (const [key, value] of [
    ['PUBLIC_API_URL', config.PUBLIC_API_URL],
    ['FRONTEND_URL', config.FRONTEND_URL],
    ['GOOGLE_CALENDAR_REDIRECT_URI', config.GOOGLE_CALENDAR_REDIRECT_URI],
  ] as const) {
    if (!value) continue;
    try {
      const url = new URL(value);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        (['FRONTEND_URL', 'PUBLIC_API_URL'].includes(key) &&
          url.origin !== value)
      )
        throw new Error();
    } catch {
      throw new Error(`Configuracion invalida: ${key}`);
    }
  }
  if (/^(change|replace|example|secret|your[_-])/i.test(config.JWT_SECRET))
    throw new Error('Configuracion invalida: JWT_SECRET de ejemplo');
  if (
    config.ASSISTANT_KEYS_SECRET &&
    Buffer.from(config.ASSISTANT_KEYS_SECRET, 'base64').length !== 32
  )
    throw new Error('Configuracion invalida: ASSISTANT_KEYS_SECRET');
  if (
    config.NODE_ENV === 'production' &&
    config.MAIL_TRANSPORT === 'smtp' &&
    (!config.PUBLIC_API_URL.startsWith('https://') ||
      (!config.SMTP_SECURE && !config.SMTP_REQUIRE_TLS))
  )
    throw new Error(
      'Configuracion invalida: correo de produccion requiere HTTPS y TLS',
    );
  if (
    config.MAIL_TRANSPORT === 'brevo' &&
    (!config.BREVO_API_KEY ||
      (config.NODE_ENV === 'production' &&
        !config.PUBLIC_API_URL.startsWith('https://')))
  )
    throw new Error(
      'Configuracion invalida: Brevo requiere BREVO_API_KEY y HTTPS',
    );
  if (Boolean(config.SMTP_USER) !== Boolean(config.SMTP_PASSWORD))
    throw new Error('Configuracion invalida: credenciales SMTP incompletas');
  return config;
}
