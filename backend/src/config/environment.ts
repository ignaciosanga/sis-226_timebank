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
  GOOGLE_CALENDAR_REDIRECT_URI?: string;

  @IsString()
  FRONTEND_URL = 'http://localhost:5173';
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
  ]) {
    if (input[key] !== undefined) parsed[key] = Number(input[key]);
  }
  for (const key of [
    'DATABASE_ENABLED',
    'SWAGGER_ENABLED',
    'GOOGLE_CALENDAR_ENABLED',
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
    ['FRONTEND_URL', config.FRONTEND_URL],
    ['GOOGLE_CALENDAR_REDIRECT_URI', config.GOOGLE_CALENDAR_REDIRECT_URI],
  ] as const) {
    if (!value) continue;
    try {
      const url = new URL(value);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        (key === 'FRONTEND_URL' && url.origin !== value)
      )
        throw new Error();
    } catch {
      throw new Error(`Configuracion invalida: ${key}`);
    }
  }
  if (/^(change|replace|example|secret|your[_-])/i.test(config.JWT_SECRET))
    throw new Error('Configuracion invalida: JWT_SECRET de ejemplo');
  return config;
}
