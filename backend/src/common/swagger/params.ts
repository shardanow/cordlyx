import { ApiParam, ApiQuery } from '@nestjs/swagger';

/** Shared path-parameter decorators — one definition per param name, reused everywhere. */

export const ApiProjectSlugParam = (description = 'Project slug, e.g. demo') =>
  ApiParam({ name: 'projectSlug', description, example: 'demo' });

export const ApiUuidParam = (name: string, description?: string) =>
  ApiParam({ name, description, schema: { type: 'string', format: 'uuid' } });

export const ApiSequenceNumParam = (
  description = 'Item sequence number within the project, e.g. 1',
) => ApiParam({ name: 'sequenceNum', description, schema: { type: 'integer' }, example: 1 });

/** Shared boolean-ish query flags (accept 1/true/yes/on and 0/false/no/off). */
export const ApiDedupeQuery = (def = true) =>
  ApiQuery({
    name: 'dedupe',
    required: false,
    description: `Skip rows already present (default ${def}).`,
    schema: { type: 'string', default: String(def) },
  });

export const ApiDryRunQuery = () =>
  ApiQuery({
    name: 'dryRun',
    required: false,
    description: 'Preview without writes; returns what would happen (default false).',
    schema: { type: 'string', default: 'false' },
  });

export const ApiExportFormatQuery = (formats: string[] = ['csv', 'json', 'jsonl']) =>
  ApiQuery({
    name: 'format',
    required: false,
    description: `Export format (default ${formats[0]}).`,
    schema: { type: 'string', enum: formats, default: formats[0] },
  });
