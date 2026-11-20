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
    if (status >= 500)
      this.logger.error(`Fallo HTTP ${status}; metodo ${request.method}`);
    response.status(status).json({
      statusCode: status,
      message,
      ...(code ? { code } : {}),
      timestamp: new Date().toISOString(),
    });
  }
}
