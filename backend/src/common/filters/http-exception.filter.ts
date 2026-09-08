import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { NotModifiedException } from '../not-modified.exception.js';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    // ETag hit: empty 304, no JSON envelope.
    if (exception instanceof NotModifiedException) {
      response.status(304).end();
      return;
    }

    // Handle Zod validation errors as 400
    if (exception instanceof ZodError) {
      response.status(400).json({
        statusCode: 400,
        error: 'Bad Request',
        message: exception.errors[0]?.message ?? 'Validation failed',
        details: exception.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
        requestId: request.requestId ?? randomUUID(),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : typeof exceptionResponse === 'object' && exceptionResponse !== null
          ? (exceptionResponse as Record<string, unknown>).message ?? 'Internal server error'
          : 'Internal server error';

    const details =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as Record<string, unknown>).errors ?? (exceptionResponse as Record<string, unknown>).details ?? undefined
        : undefined;

    response.status(status).json({
      statusCode: status,
      error: HttpStatus[status] ?? 'Unknown',
      message: Array.isArray(message) ? message[0] : message,
      details: details,
      requestId: request.requestId ?? randomUUID(),
      timestamp: new Date().toISOString(),
    });

    // Visibility for ops: 5xx always logged, 429 (rate limiting) as warning.
    // Routine 4xx stay quiet to avoid log flooding.
    const method = request.method ?? '?';
    const url = request.originalUrl ?? request.url ?? '?';
    const msg = Array.isArray(message) ? message[0] : message;
    if (status >= 500) {
      this.logger.error(`${method} ${url} → ${status} requestId=${request.requestId ?? '-'} ${msg}`);
    } else if (status === 429) {
      this.logger.warn(`${method} ${url} → 429 rate limited`);
    }
  }
}
