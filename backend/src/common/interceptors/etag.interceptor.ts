import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Observable, map } from 'rxjs';
import { NotModifiedException } from '../not-modified.exception.js';

/**
 * Weak-ETag support for heavy GET endpoints (list, board, exports).
 * Sets `ETag: W/"<sha256hex>"`; on `If-None-Match` hit throws
 * NotModifiedException → empty 304 via AllExceptionsFilter.
 * Bodies are hashed, never stored — stateless, replica-safe.
 */
@Injectable()
export class EtagInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    if (req.method !== 'GET') return next.handle();
    const ifNoneMatch = req.headers?.['if-none-match'] as string | undefined;
    return next.handle().pipe(
      map((body) => {
        // Skip empty bodies; strings (CSV/JSONL exports) are hashed like objects.
        if (body === undefined || body === null) return body;
        if (typeof body !== 'object' && typeof body !== 'string') return body;
        let serialized: string;
        try {
          serialized = typeof body === 'string' ? body : JSON.stringify(body);
        } catch {
          return body;
        }
        const etag = `W/"${createHash('sha256').update(serialized).digest('hex')}"`;
        context.switchToHttp().getResponse().setHeader('ETag', etag);
        if (ifNoneMatch === etag) throw new NotModifiedException();
        return body;
      }),
    );
  }
}
