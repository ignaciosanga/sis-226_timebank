import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

const blocked = new Set(['password', 'password_hash', 'passwordHash']);

export function redactSensitiveFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitiveFields);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !blocked.has(key))
        .map(([key, entry]) => [key, redactSensitiveFields(entry)]),
    );
  }
  return value;
}

@Injectable()
export class SensitiveFieldsInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(map(redactSensitiveFields));
  }
}
