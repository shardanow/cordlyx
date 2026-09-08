import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiQuery, type SchemaObject } from '@nestjs/swagger';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodRawShape, ZodObject, ZodTypeAny } from 'zod';

const schemaCache = new Map<ZodTypeAny, Record<string, unknown>>();

/**
 * Converts a shared Zod schema to a plain OpenAPI-compatible JSON schema.
 * Results are cached per schema object. The `$schema` marker emitted by
 * zod-to-json-schema is stripped (meaningless inside an OpenAPI document).
 */
export function toJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  const cached = schemaCache.get(schema);
  if (cached) return cached;
  const { $schema: _ignored, ...rest } = zodToJsonSchema(schema) as Record<string, unknown> & {
    $schema?: string;
  };
  schemaCache.set(schema, rest);
  return rest;
}

/**
 * Documents a JSON request body from a shared Zod schema.
 * Runtime validation stays where it is (explicit `schema.parse()` in the
 * handler) — this decorator is docs metadata only.
 */
export function ApiZodBody(schema: ZodTypeAny, description?: string) {
  return ApiBody({ description, schema: toJsonSchema(schema) as SchemaObject });
}

/**
 * Expands a shared Zod object schema into individual query parameters.
 * Use for GET list/search endpoints instead of hand-writing @ApiQuery per field.
 */
export function ApiZodQuery(schema: ZodObject<ZodRawShape>) {
  const json = toJsonSchema(schema);
  const properties = (json.properties ?? {}) as Record<string, SchemaObject>;
  const required = new Set((json.required as string[] | undefined) ?? []);
  return applyDecorators(
    ...Object.entries(properties).map(([name, prop]) =>
      ApiQuery({ name, required: required.has(name), schema: prop }),
    ),
  );
}
