import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Thrown by EtagInterceptor on If-None-Match hit.
 * Handled explicitly by AllExceptionsFilter (empty 304, no JSON envelope).
 */
export class NotModifiedException extends HttpException {
  constructor() {
    // Message is never rendered: AllExceptionsFilter answers empty 304.
    super('Not Modified', HttpStatus.NOT_MODIFIED);
  }
}
