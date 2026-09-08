import { BadRequestException } from '@nestjs/common';

/** Max rows per per-module bulk/import request (snapshots use their own higher limit). */
export const TRANSFER_MAX_ROWS = 100;
/** Max uploaded transfer file size (same as attachments). */
export const TRANSFER_MAX_BYTES = 10 * 1024 * 1024;

export type TransferFormat = 'csv' | 'json' | 'jsonl';

export type TransferStatus = 'created' | 'skipped' | 'failed';

export interface TransferItemResult {
  index: number;
  status: TransferStatus;
  id?: string;
  title: string;
  error?: string;
  /** Internal payload (e.g. for event emission), stripped from the HTTP response. */
  item?: unknown;
}

/** Normalize a string for case-insensitive name matching. */
export function normalizeName(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Parse an RFC-4180 style CSV (quotes, escaped quotes, commas and newlines inside quotes). */
export function parseCsv(text: string): Record<string, string>[] {
  const src = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const c = src.charAt(i);
    if (inQuotes) {
      if (c === '"') {
        if (src.charAt(i + 1) === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c === '\r') {
      // skip, \n follows
    } else {
      field += c;
    }
  }
  row.push(field);
  rows.push(row);

  const nonEmpty = rows.filter((r) => r.some((v) => v.trim() !== ''));
  const headerRow = nonEmpty[0];
  if (!headerRow) return [];
  const headers = headerRow.map((h) => h.trim());
  return nonEmpty.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? '').trim();
    });
    return obj;
  });
}

export function detectTransferFormat(filename: string, content: string): TransferFormat {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'csv') return 'csv';
  if (ext === 'json') return 'json';
  if (ext === 'jsonl' || ext === 'ndjson') return 'jsonl';
  const trimmed = content.trimStart();
  if (trimmed.startsWith('[')) return 'json';
  const lines = trimmed
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length > 0 && lines.every((l) => l.startsWith('{'))) return 'jsonl';
  return 'csv';
}

/** Parse an uploaded transfer file into raw rows (no header mapping). */
export function parseTransferBuffer(
  buffer: Buffer,
  filename: string,
  opts?: { maxBytes?: number; maxRows?: number },
): { format: TransferFormat; rows: Record<string, unknown>[] } {
  const maxBytes = opts?.maxBytes ?? TRANSFER_MAX_BYTES;
  if (buffer.length > maxBytes) {
    throw new BadRequestException('File is too large (max 10 MB)');
  }
  const content = buffer.toString('utf-8');
  if (!content.trim()) {
    throw new BadRequestException('File is empty');
  }
  const format = detectTransferFormat(filename, content);
  let rows: Record<string, unknown>[];
  try {
    if (format === 'csv') {
      rows = parseCsv(content);
    } else if (format === 'json') {
      const parsed: unknown = JSON.parse(content);
      if (!Array.isArray(parsed)) {
        throw new BadRequestException('JSON import must be an array of objects');
      }
      rows = parsed as Record<string, unknown>[];
    } else {
      rows = content
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line, idx) => {
          try {
            return JSON.parse(line) as Record<string, unknown>;
          } catch {
            throw new BadRequestException(`Invalid JSON on line ${idx + 1}`);
          }
        });
    }
  } catch (err) {
    if (err instanceof BadRequestException) throw err;
    throw new BadRequestException(`Failed to parse ${format.toUpperCase()} file`);
  }
  const maxRows = opts?.maxRows ?? TRANSFER_MAX_ROWS;
  if (rows.length === 0) {
    throw new BadRequestException('File contains no data rows');
  }
  if (rows.length > maxRows) {
    throw new BadRequestException(`Too many rows (max ${maxRows} per import)`);
  }
  return { format, rows };
}

/** Parse a boolean query flag (?dryRun=true|false), falling back to a default. */
export function parseFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const v = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return fallback;
}

/** Remove internal fields (e.g. `item`) from transfer results before responding. */
export function stripInternal<T extends { item?: unknown }>(results: T[]): Omit<T, 'item'>[] {
  return results.map(({ item: _item, ...rest }) => rest);
}

export function summarizeTransfer(results: { status: TransferStatus }[]): {
  created: number;
  skipped: number;
  failed: number;
} {
  return {
    created: results.filter((r) => r.status === 'created').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    failed: results.filter((r) => r.status === 'failed').length,
  };
}
