import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

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
  }
}
