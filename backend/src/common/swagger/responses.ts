import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiResponse } from '@nestjs/swagger';

/** Standard error envelope (see AllExceptionsFilter). */
export class ErrorResponseDto {
  @ApiProperty({ example: 404 })
  statusCode!: number;

  @ApiProperty({ example: 'Not Found' })
  error!: string;

  @ApiProperty({ example: 'Plan not found' })
  message!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  requestId!: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  timestamp!: string;
}

const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: 'Validation failed (see details with per-field errors)',
  401: 'Missing or invalid credentials',
  403: 'Insufficient role, or API key scoped to another project',
  404: 'Resource not found',
  409: 'Conflict (e.g. duplicate slug, username or email)',
  429: 'Rate limit exceeded (see Retry-After header)',
};

/**
 * Attaches the standard error envelope for the given statuses.
 * Default set covers the errors a typical guarded route can produce.
 */
export function ApiErrorResponses(
  ...statuses: number[]
) {
  const list = statuses.length > 0 ? statuses : [400, 401, 403, 404, 429];
  return applyDecorators(
    ...list.map((status) =>
      ApiResponse({
        status,
        description: ERROR_DESCRIPTIONS[status] ?? 'Error',
        type: ErrorResponseDto,
      }),
    ),
  );
}

/**
 * Documents a cursor-paginated list response: `{ data: [...], meta }`.
 * Use ONLY for endpoints that really wrap (items, search, notifications,
 * activities). Plain-array lists use `@ApiResponse({ isArray: true, type })`.
 * Pass a representative item example (docs-only, no runtime effect).
 */
export function ApiListResponse(description: string, itemExample?: Record<string, unknown>) {
  return ApiResponse({
    status: 200,
    description,
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object', example: itemExample } },
        meta: {
          type: 'object',
          properties: {
            cursor: { type: 'string', nullable: true, description: 'Pass as ?cursor for the next page.' },
            hasMore: { type: 'boolean' },
            limit: { type: 'integer' },
          },
        },
      },
    },
  });
}
