import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] =
      status >= 500
        ? 'Servicio temporalmente no disponible'
        : 'Solicitud rechazada';
    let code: string | undefined;
    if (exception instanceof HttpException && status < 500) {
      const body = exception.getResponse();
      if (
        typeof body === 'object' &&
        body !== null &&
        'code' in body &&
        typeof body.code === 'string' &&
        [
          'EMAIL_VERIFICATION_REQUIRED',
          'OFFER_PRICE_FLOW_PENDING',
          'OFFER_AVAILABILITY_MANAGED',
          'OFFER_MISMATCH',
          'OFFER_NOT_AVAILABLE',
          'OFFER_SNAPSHOT_REQUIRED',
          'DECIMAL_SETTLEMENT_PENDING',
          'CANCELLATION_BALANCE_POLICY_PENDING',
          'ASSISTANT_QUOTA_EXCEEDED',
        ].includes(body.code)
      )
        code = body.code;
      if (typeof body === 'string') message = body;
      else if (typeof body === 'object' && body !== null && 'message' in body) {
        const candidate: unknown = body.message;
        if (
          typeof candidate === 'string' ||
          (Array.isArray(candidate) &&
            candidate.every((item) => typeof item === 'string'))
        )
          message = candidate;
      }
    }
    // No registrar excepciones, body, URL ni cabeceras: pueden incluir secretos.
    if (status >= 500) {
      const route = (request as { route?: { path?: unknown } }).route?.path;
      const kind =
        exception instanceof Error ? exception.constructor.name : 'Desconocido';
      this.logger.error(
        `Fallo HTTP ${status}; metodo ${request.method}; ruta ${typeof route === 'string' ? route : 'sin ruta'}; error ${kind}`,
      );
    }
    response.status(status).json({
      statusCode: status,
      message,
      ...(code ? { code } : {}),
      timestamp: new Date().toISOString(),
    });
  }
}
