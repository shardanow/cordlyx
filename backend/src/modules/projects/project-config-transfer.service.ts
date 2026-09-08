import { Injectable, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { getDb } from '../../database/client.js';
import { itemTypes, itemStatuses, itemPriorities } from '../../database/schema/config.js';
import { tags as tagsTable } from '../../database/schema/tags.js';
import { CacheService } from '../../cache/cache.service.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  createItemTypeSchema,
  createItemStatusSchema,
  createItemPrioritySchema,
  createTagSchema,
} from '@cordlyx/shared';
import { normalizeName } from '../../common/transfer.util.js';

export type ConfigKind = 'types' | 'statuses' | 'priorities' | 'tags';

export interface ConfigImportResult {
  kind: ConfigKind;
  name: string;
  status: 'created' | 'updated' | 'unchanged' | 'failed';
  error?: string;
}

const configFileSchema = z.object({
  version: z.number().optional(),
  types: z.array(z.unknown()).optional().default([]),
  statuses: z.array(z.unknown()).optional().default([]),
  priorities: z.array(z.unknown()).optional().default([]),
  tags: z.array(z.unknown()).optional().default([]),
});

const typeRowSchema = createItemTypeSchema
  .pick({ name: true, color: true })
  .extend({ icon: z.string().max(50).nullable().optional(), sortOrder: z.number().int().optional() });
const statusRowSchema = createItemStatusSchema
  .pick({ name: true, color: true, category: true })
  .extend({ sortOrder: z.number().int().optional() });
const priorityRowSchema = createItemPrioritySchema
  .pick({ name: true })
  .extend({
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
    icon: z.string().max(50).nullable().optional(),
    sortOrder: z.number().int().optional(),
  });
const tagRowSchema = createTagSchema;

const KIND_SCHEMAS: Record<ConfigKind, z.ZodTypeAny> = {
  types: typeRowSchema,
  statuses: statusRowSchema,
  priorities: priorityRowSchema,
  tags: tagRowSchema,
};

/** Fields compared/applied per kind on upsert (isDefault is never touched). */
const KIND_FIELDS: Record<ConfigKind, string[]> = {
  types: ['color', 'icon', 'sortOrder'],
  statuses: ['color', 'category', 'sortOrder'],
  priorities: ['color', 'icon', 'sortOrder'],
  tags: ['color'],
};

@Injectable()
export class ProjectConfigTransferService {
  constructor(private readonly cache: CacheService) {}

  async exportConfig(projectId: string) {
    const db = getDb();
    const [types, statuses, priorities, tags] = await Promise.all([
      db.select().from(itemTypes).where(eq(itemTypes.projectId, projectId)).orderBy(itemTypes.sortOrder),
      db.select().from(itemStatuses).where(eq(itemStatuses.projectId, projectId)).orderBy(itemStatuses.sortOrder),
      db.select().from(itemPriorities).where(eq(itemPriorities.projectId, projectId)).orderBy(itemPriorities.sortOrder),
      db.select().from(tagsTable).where(eq(tagsTable.projectId, projectId)),
    ]);
    return {
      version: 1,
      types: types.map((t) => ({ name: t.name, color: t.color, icon: t.icon, sortOrder: t.sortOrder, isDefault: t.isDefault })),
      statuses: statuses.map((s) => ({ name: s.name, color: s.color, category: s.category, sortOrder: s.sortOrder, isDefault: s.isDefault })),
      priorities: priorities.map((p) => ({ name: p.name, color: p.color, icon: p.icon, sortOrder: p.sortOrder, isDefault: p.isDefault })),
      tags: tags.map((t) => ({ name: t.name, color: t.color })),
    };
  }

  async importFile(
    projectId: string,
    file: { originalname: string; buffer: Buffer },
    opts?: { dryRun?: boolean },
  ): Promise<{ data: ConfigImportResult[]; meta: { created: number; updated: number; unchanged: number; failed: number; dryRun: boolean } }> {
    if (file.buffer.length > 10 * 1024 * 1024) {
      throw new BadRequestException('File is too large (max 10 MB)');
    }
    const name = (file.originalname ?? '').toLowerCase();
    if (name.endsWith('.csv')) {
      throw new BadRequestException('Config import supports JSON only (export your config first to see the format)');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(file.buffer.toString('utf-8'));
    } catch {
      throw new BadRequestException('Invalid JSON file');
    }
    const data = configFileSchema.parse(parsed);
    return this.importConfig(projectId, data, opts);
  }

  async importConfig(
    projectId: string,
    data: { types?: unknown[]; statuses?: unknown[]; priorities?: unknown[]; tags?: unknown[] },
    opts?: { dryRun?: boolean },
  ): Promise<{ data: ConfigImportResult[]; meta: { created: number; updated: number; unchanged: number; failed: number; dryRun: boolean } }> {
    const dryRun = opts?.dryRun === true;
    const db = getDb();
    const results: ConfigImportResult[] = [];
    let touched = false;

    const tables = { types: itemTypes, statuses: itemStatuses, priorities: itemPriorities, tags: tagsTable } as const;
    for (const kind of ['types', 'statuses', 'priorities', 'tags'] as const) {
      const rows = data[kind] ?? [];
      const table = tables[kind];
      const existing = await db.select().from(table).where(eq(table.projectId, projectId));
      const byName = new Map(existing.map((r) => [normalizeName((r as { name: string }).name), r]));

      for (const raw of rows) {
        let parsed: Record<string, unknown>;
        try {
          parsed = KIND_SCHEMAS[kind].parse(raw) as Record<string, unknown>;
        } catch (err) {
          results.push({ kind, name: nameOf(raw), status: 'failed', error: zodMessage(err) });
          continue;
        }
        const rowName = String(parsed.name);
        const found = byName.get(normalizeName(rowName)) as Record<string, unknown> | undefined;
        if (!found) {
          if (!dryRun) {
            await db.insert(table).values({
              id: randomUUID(),
              projectId,
              name: rowName,
              ...pickFields(kind, parsed),
            } as never);
            touched = true;
          }
          results.push({ kind, name: rowName, status: 'created' });
          continue;
        }
        const diff = diffFields(kind, found, parsed);
        if (Object.keys(diff).length === 0) {
          results.push({ kind, name: rowName, status: 'unchanged' });
          continue;
        }
        if (!dryRun) {
          const setValues: Record<string, unknown> = { ...diff };
          if (hasUpdatedAt(found)) setValues.updatedAt = new Date();
          await db
            .update(table)
            .set(setValues as never)
            .where(eq((table as { id: unknown }).id as never, (found.id ?? found) as never));
          touched = true;
        }
        results.push({ kind, name: rowName, status: 'updated' });
      }
    }

    if (touched) {
      await Promise.all([
        this.cache.del(`config:types:${projectId}`),
        this.cache.del(`config:statuses:${projectId}`),
        this.cache.del(`config:priorities:${projectId}`),
      ]);
    }
    const meta = {
      created: results.filter((r) => r.status === 'created').length,
      updated: results.filter((r) => r.status === 'updated').length,
      unchanged: results.filter((r) => r.status === 'unchanged').length,
      failed: results.filter((r) => r.status === 'failed').length,
      dryRun,
    };
    return { data: results, meta };
  }
}

function pickFields(kind: ConfigKind, parsed: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of KIND_FIELDS[kind]) {
    if (parsed[f] !== undefined) out[f] = parsed[f];
  }
  return out;
}

function diffFields(kind: ConfigKind, existing: Record<string, unknown>, parsed: Record<string, unknown>): Record<string, unknown> {
  const diff: Record<string, unknown> = {};
  for (const f of KIND_FIELDS[kind]) {
    if (parsed[f] === undefined) continue; // absent in import → leave as-is
    const next = parsed[f] ?? null;
    const prev = (existing[f] ?? null) as unknown;
    // drizzle integers may come back as numbers already; compare loosely via String
    if (String(prev ?? '') !== String(next ?? '')) {
      diff[f] = next;
    }
  }
  return diff;
}

function hasUpdatedAt(row: Record<string, unknown>): boolean {
  return 'updatedAt' in row;
}

function nameOf(raw: unknown): string {
  if (raw && typeof raw === 'object' && 'name' in raw) return String((raw as { name: unknown }).name ?? '');
  return '';
}

function zodMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'issues' in err && Array.isArray((err as { issues: unknown[] }).issues)) {
    return (err as { issues: { path: (string | number)[]; message: string }[] }).issues
      .map((i) => `${i.path.join('.') || 'value'}: ${i.message}`)
      .join('; ');
  }
  return err instanceof Error ? err.message : String(err);
}
