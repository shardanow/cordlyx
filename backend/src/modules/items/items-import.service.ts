import { Injectable, BadRequestException } from '@nestjs/common';
import { getDb } from '../../database/client.js';
import { items } from '../../database/schema/items.js';
import { itemTypes, itemStatuses, itemPriorities } from '../../database/schema/config.js';
import { users } from '../../database/schema/users.js';
import { projectMembers } from '../../database/schema/members.js';
import { tags as tagsTable } from '../../database/schema/tags.js';
import { plans } from '../../database/schema/plans.js';
import { eq, and, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { createItemSchema } from '@cordlyx/shared';
import { ItemsService } from './items.service.js';

export const BULK_MAX_ITEMS = 100;
export const IMPORT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB, same as attachments
const DEFAULT_TAG_COLOR = '#6b7280';

export type BulkResultStatus = 'created' | 'skipped' | 'failed';

export interface BulkItemResult {
  index: number;
  status: BulkResultStatus;
  id?: string;
  sequenceNum?: number | null;
  title: string;
  error?: string;
  /** Internal: minimal created item for event emission, stripped from the HTTP response. */
  item?: { id: string; title: string };
}

export interface BulkMeta {
  created: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  dedupe: boolean;
}

export const bulkRequestSchema = z.object({
  items: z.array(z.unknown()).min(1).max(BULK_MAX_ITEMS),
  dedupe: z.boolean().optional().default(true),
  dryRun: z.boolean().optional().default(false),
});

// ---------------------------------------------------------------------------
// Pure helpers (no DB) — covered by unit tests.
// ---------------------------------------------------------------------------

/** Normalize a string for case-insensitive name matching. */
export function normalizeName(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Dedupe key for an item: normalized title + normalized type name.
 * Re-importing the same file only adds rows that are not present yet.
 */
export function dedupeKey(title: string, typeName: string): string {
  return `${normalizeName(title)}|${normalizeName(typeName)}`;
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

export type ImportFormat = 'csv' | 'json' | 'jsonl';

export function detectImportFormat(filename: string, content: string): ImportFormat {
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

const HEADER_ALIASES: Record<string, string> = {
  title: 'title',
  description: 'description',
  type: 'type',
  typename: 'typeName',
  typeid: 'typeId',
  status: 'status',
  statusname: 'statusName',
  statusid: 'statusId',
  priority: 'priority',
  priorityname: 'priorityName',
  priorityid: 'priorityId',
  assignee: 'assignee',
  assigneename: 'assigneeName',
  assigneeemail: 'assigneeEmail',
  assigneeid: 'assigneeId',
  email: 'assigneeEmail',
  duedate: 'dueDate',
  startdate: 'startDate',
  estimatedhours: 'estimatedHours',
  esthours: 'estimatedHours',
  tags: 'tags',
  tag: 'tags',
  plan: 'plan',
  planname: 'planName',
  planid: 'planId',
};

const IGNORED_COLUMNS = new Set([
  'id',
  'sequence',
  'sequencenum',
  'category',
  'created',
  'updated',
  'createdat',
  'updatedat',
  'sortorder',
]);

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[\s_.]+/g, '');
}

/** Map arbitrary CSV headers (incl. our own export format) to canonical import fields. */
export function mapImportHeaders(row: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(row)) {
    const key = normalizeHeader(rawKey);
    if (IGNORED_COLUMNS.has(key)) continue;
    const mapped = HEADER_ALIASES[key];
    if (!mapped) continue;
    if (value === '') continue;
    out[mapped] = value;
  }
  return out;
}

/** Parse an uploaded file into canonical import rows. Throws BadRequestException on bad input. */
export function parseImportBuffer(
  buffer: Buffer,
  filename: string,
): { format: ImportFormat; rows: Record<string, unknown>[] } {
  if (buffer.length > IMPORT_MAX_BYTES) {
    throw new BadRequestException('File is too large (max 10 MB)');
  }
  const content = buffer.toString('utf-8');
  if (!content.trim()) {
    throw new BadRequestException('File is empty');
  }
  const format = detectImportFormat(filename, content);
  try {
    if (format === 'csv') {
      return { format, rows: parseCsv(content).map(mapImportHeaders) };
    }
    if (format === 'json') {
      const parsed: unknown = JSON.parse(content);
      if (!Array.isArray(parsed)) {
        throw new BadRequestException('JSON import must be an array of objects');
      }
      return { format, rows: parsed as Record<string, unknown>[] };
    }
    const rows = content
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
    return { format, rows };
  } catch (err) {
    if (err instanceof BadRequestException) throw err;
    throw new BadRequestException(`Failed to parse ${format.toUpperCase()} file`);
  }
}

function normalizeDatetime(value: unknown): { iso?: string; error?: string } {
  if (value == null || String(value).trim() === '') return {};
  const d = new Date(String(value).trim());
  if (Number.isNaN(d.getTime())) {
    return { error: `Invalid date: "${value}" (expected ISO or YYYY-MM-DD)` };
  }
  return { iso: d.toISOString() };
}

function normalizeHours(value: unknown): { hours?: number; error?: string } {
  if (value == null || String(value).trim() === '') return {};
  const n = Number(String(value).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 999999) {
    return { error: `Invalid estimatedHours: "${value}"` };
  }
  return { hours: Math.round(n * 10) / 10 };
}

function splitTagNames(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (value == null) return [];
  return String(value)
    .split(/[,;]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// DB-backed import.
// ---------------------------------------------------------------------------

interface ImportContext {
  typesById: Map<string, { id: string; name: string }>;
  typesByName: Map<string, { id: string; name: string }>;
  statusesById: Map<string, { id: string; name: string }>;
  statusesByName: Map<string, { id: string; name: string }>;
  prioritiesById: Map<string, { id: string; name: string }>;
  prioritiesByName: Map<string, { id: string; name: string }>;
  membersById: Map<string, { id: string; email: string; name: string }>;
  membersByEmail: Map<string, { id: string; email: string; name: string }>;
  membersByName: Map<string, { id: string; email: string; name: string }>;
  plansById: Map<string, { id: string; name: string }>;
  plansByName: Map<string, { id: string; name: string }>;
  tagsById: Map<string, { id: string; name: string }>;
  tagsByName: Map<string, { id: string; name: string }>;
  existingKeys: Set<string>;
}

type CreatePayload = Parameters<ItemsService['create']>[1];

@Injectable()
export class ItemsImportService {
  constructor(private readonly itemsService: ItemsService) {}

  async bulkCreate(
    projectId: string,
    reporterId: string,
    rawItems: unknown[],
    opts?: { dedupe?: boolean; dryRun?: boolean },
  ): Promise<{ data: BulkItemResult[]; meta: BulkMeta }> {
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      throw new BadRequestException('Body must contain a non-empty "items" array');
    }
    if (rawItems.length > BULK_MAX_ITEMS) {
      throw new BadRequestException(`Too many items (max ${BULK_MAX_ITEMS} per request)`);
    }
    const ctx = await this.loadContext(projectId);
    const dedupe = opts?.dedupe !== false;
    const dryRun = opts?.dryRun === true;
    const results: BulkItemResult[] = [];

    for (let index = 0; index < rawItems.length; index++) {
      const raw = rawItems[index];
      let parsed: z.infer<typeof createItemSchema>;
      try {
        parsed = createItemSchema.parse(raw);
      } catch (err) {
        results.push({ index, status: 'failed', title: titleOf(raw), error: zodMessage(err) });
        continue;
      }
      const typeEntry = ctx.typesById.get(parsed.typeId);
      if (!typeEntry) {
        results.push({ index, status: 'failed', title: parsed.title, error: `Unknown typeId: "${parsed.typeId}"` });
        continue;
      }
      const refError = validateBulkRefs(ctx, parsed);
      if (refError) {
        results.push({ index, status: 'failed', title: parsed.title, error: refError });
        continue;
      }
      const payload: CreatePayload = { ...parsed };
      const key = dedupeKey(parsed.title, typeEntry.name);
      if (dedupe && ctx.existingKeys.has(key)) {
        results.push({ index, status: 'skipped', title: parsed.title });
        continue;
      }
      if (dryRun) {
        ctx.existingKeys.add(key);
        results.push({ index, status: 'created', title: parsed.title, sequenceNum: null });
        continue;
      }
      try {
        const created = (await this.itemsService.create(projectId, payload, reporterId))!;
        ctx.existingKeys.add(key);
        results.push({
          index,
          status: 'created',
          id: created.id,
          sequenceNum: created.sequenceNum,
          title: created.title,
          item: { id: created.id, title: created.title },
        });
      } catch (err) {
        results.push({ index, status: 'failed', title: parsed.title, error: messageOf(err) });
      }
    }
    return { data: results, meta: summarize(results, { dryRun, dedupe }) };
  }

  async importFile(
    projectId: string,
    reporterId: string,
    file: { originalname: string; buffer: Buffer },
    opts?: { dedupe?: boolean; dryRun?: boolean },
  ): Promise<{ data: BulkItemResult[]; meta: BulkMeta & { format: ImportFormat } }> {
    const { format, rows } = parseImportBuffer(file.buffer, file.originalname ?? '');
    if (rows.length === 0) {
      throw new BadRequestException('File contains no data rows');
    }
    if (rows.length > BULK_MAX_ITEMS) {
      throw new BadRequestException(`Too many rows (max ${BULK_MAX_ITEMS} per import)`);
    }
    const ctx = await this.loadContext(projectId);
    const dedupe = opts?.dedupe !== false;
    const dryRun = opts?.dryRun === true;

    // Pass 1: resolve rows (collect missing tag names for auto-creation).
    const resolved = rows.map((row, index) => this.resolveRow(ctx, row, index));
    const missingTags = new Set<string>();
    for (const r of resolved) {
      if (r.tagNames) for (const n of r.tagNames) if (!ctx.tagsByName.has(normalizeName(n))) missingTags.add(n);
    }
    if (missingTags.size > 0 && !dryRun) {
      await this.createMissingTags(projectId, [...missingTags]);
      const db = getDb();
      const allTags = await db.select().from(tagsTable).where(eq(tagsTable.projectId, projectId));
      for (const t of allTags) ctx.tagsByName.set(normalizeName(t.name), { id: t.id, name: t.name });
    }

    // Pass 2: dedupe + create.
    const results: BulkItemResult[] = [];
    for (const r of resolved) {
      if (r.error || !r.payload || !r.typeName) {
        results.push({ index: r.index, status: 'failed', title: r.title, error: r.error ?? 'Invalid row' });
        continue;
      }
      const key = dedupeKey(r.title, r.typeName);
      if (dedupe && ctx.existingKeys.has(key)) {
        results.push({ index: r.index, status: 'skipped', title: r.title });
        continue;
      }
      if (dryRun) {
        if (r.tagNames?.some((n) => !ctx.tagsByName.has(normalizeName(n)))) {
          // In dry-run tags are not created — still counts as creatable.
        }
        ctx.existingKeys.add(key);
        results.push({ index: r.index, status: 'created', title: r.title, sequenceNum: null });
        continue;
      }
      const tagIds = (r.tagNames ?? [])
        .map((n) => ctx.tagsByName.get(normalizeName(n))?.id)
        .filter((v): v is string => Boolean(v));
      try {
        const created = (await this.itemsService.create(projectId, { ...r.payload, tagIds }, reporterId))!;
        ctx.existingKeys.add(key);
        results.push({
          index: r.index,
          status: 'created',
          id: created.id,
          sequenceNum: created.sequenceNum,
          title: created.title,
          item: { id: created.id, title: created.title },
        });
      } catch (err) {
        results.push({ index: r.index, status: 'failed', title: r.title, error: messageOf(err) });
      }
    }
    return { data: results, meta: { ...summarize(results, { dryRun, dedupe }), format } };
  }

  // --- internals ---

  private async loadContext(projectId: string): Promise<ImportContext> {
    const db = getDb();
    const [types, statuses, priorities, planRows, tagRows, memberRows, existingItems] = await Promise.all([
      db.select().from(itemTypes).where(eq(itemTypes.projectId, projectId)),
      db.select().from(itemStatuses).where(eq(itemStatuses.projectId, projectId)),
      db.select().from(itemPriorities).where(eq(itemPriorities.projectId, projectId)),
      db.select().from(plans).where(eq(plans.projectId, projectId)),
      db.select().from(tagsTable).where(eq(tagsTable.projectId, projectId)),
      db
        .select({ id: users.id, email: users.email, name: users.name })
        .from(projectMembers)
        .innerJoin(users, eq(projectMembers.userId, users.id))
        .where(eq(projectMembers.projectId, projectId)),
      db
        .select({ title: items.title, typeId: items.typeId })
        .from(items)
        .where(and(eq(items.projectId, projectId), isNull(items.deletedAt))),
    ]);

    const byName = <T extends { id: string; name: string }>(rows: T[]) => {
      const m = new Map<string, T>();
      for (const r of rows) m.set(normalizeName(r.name), r);
      return m;
    };
    const typesById = new Map(types.map((t) => [t.id, { id: t.id, name: t.name }]));
    const existingKeys = new Set(
      existingItems.map((i) => dedupeKey(i.title, typesById.get(i.typeId)?.name ?? '')),
    );
    return {
      typesById,
      typesByName: byName(types.map((t) => ({ id: t.id, name: t.name }))),
      statusesById: new Map(statuses.map((s) => [s.id, { id: s.id, name: s.name }])),
      statusesByName: byName(statuses.map((s) => ({ id: s.id, name: s.name }))),
      prioritiesById: new Map(priorities.map((p) => [p.id, { id: p.id, name: p.name }])),
      prioritiesByName: byName(priorities.map((p) => ({ id: p.id, name: p.name }))),
      membersById: new Map(memberRows.map((m) => [m.id, m])),
      membersByEmail: new Map(memberRows.map((m) => [normalizeName(m.email), m])),
      membersByName: new Map(memberRows.map((m) => [normalizeName(m.name), m])),
      plansById: new Map(planRows.map((p) => [p.id, { id: p.id, name: p.name }])),
      plansByName: byName(planRows.map((p) => ({ id: p.id, name: p.name })) as { id: string; name: string }[]),
      tagsById: new Map(tagRows.map((t) => [t.id, { id: t.id, name: t.name }])),
      tagsByName: byName(tagRows.map((t) => ({ id: t.id, name: t.name }))),
      existingKeys,
    };
  }

  private async createMissingTags(projectId: string, names: string[]): Promise<void> {
    const db = getDb();
    for (const name of names) {
      const clean = name.trim().slice(0, 100);
      if (!clean) continue;
      try {
        await db.insert(tagsTable).values({ projectId, name: clean, color: DEFAULT_TAG_COLOR });
      } catch {
        // Unique race — tag already exists, ignore.
      }
    }
  }

  private resolveRow(
    ctx: ImportContext,
    row: Record<string, unknown>,
    index: number,
  ): { index: number; title: string; payload?: CreatePayload; typeName?: string; tagNames?: string[]; error?: string } {
    const str = (v: unknown) => (v == null ? '' : String(v).trim());
    const title = str(row.title);
    if (!title) return { index, title: '', error: 'Missing required field: title' };
    if (title.length > 500) return { index, title, error: 'Title is too long (max 500 characters)' };

    // Type: prefer explicit ID, fall back to name (default "Task").
    let typeId: string | undefined;
    let typeName = '';
    const rawTypeId = str(row.typeId);
    if (rawTypeId) {
      const found = ctx.typesById.get(rawTypeId);
      if (!found) return { index, title, error: `Unknown typeId: "${rawTypeId}"` };
      typeId = found.id;
      typeName = found.name;
    } else {
      const name = str(row.type || row.typeName) || 'Task';
      const found = ctx.typesByName.get(normalizeName(name));
      if (!found) return { index, title, error: `Unknown type: "${name}"` };
      typeId = found.id;
      typeName = found.name;
    }

    const fail = (error: string) => ({ index, title, error });

    // Status (optional — service default applies).
    let statusId: string | undefined;
    const rawStatusId = str(row.statusId);
    if (rawStatusId) {
      const found = ctx.statusesById.get(rawStatusId);
      if (!found) return fail(`Unknown statusId: "${rawStatusId}"`);
      statusId = found.id;
    } else {
      const name = str(row.status || row.statusName);
      if (name) {
        const found = ctx.statusesByName.get(normalizeName(name));
        if (!found) return fail(`Unknown status: "${name}"`);
        statusId = found.id;
      }
    }

    // Priority (optional).
    let priorityId: string | undefined;
    const rawPriorityId = str(row.priorityId);
    if (rawPriorityId) {
      const found = ctx.prioritiesById.get(rawPriorityId);
      if (!found) return fail(`Unknown priorityId: "${rawPriorityId}"`);
      priorityId = found.id;
    } else {
      const name = str(row.priority || row.priorityName);
      if (name) {
        const found = ctx.prioritiesByName.get(normalizeName(name));
        if (!found) return fail(`Unknown priority: "${name}"`);
        priorityId = found.id;
      }
    }

    // Assignee (optional): ID → email → name.
    let assigneeId: string | undefined;
    const rawAssigneeId = str(row.assigneeId);
    if (rawAssigneeId) {
      if (!ctx.membersById.has(rawAssigneeId)) return fail('Assignee is not a project member');
      assigneeId = rawAssigneeId;
    } else {
      const emailOrName = str(row.assigneeEmail || row.assignee || row.assigneeName);
      if (emailOrName) {
        const byEmail = ctx.membersByEmail.get(normalizeName(emailOrName));
        const byName = byEmail ?? ctx.membersByName.get(normalizeName(emailOrName));
        if (!byName) return fail(`Unknown assignee: "${emailOrName}" (use member email)`);
        assigneeId = byName.id;
      }
    }

    // Dates.
    const due = normalizeDatetime(row.dueDate);
    if (due.error) return fail(due.error);
    const start = normalizeDatetime(row.startDate);
    if (start.error) return fail(start.error);

    // Estimated hours.
    const hours = normalizeHours(row.estimatedHours);
    if (hours.error) return fail(hours.error);

    // Plan (optional).
    let planId: string | undefined;
    const rawPlanId = str(row.planId);
    if (rawPlanId) {
      if (!ctx.plansById.has(rawPlanId)) return fail(`Unknown planId: "${rawPlanId}"`);
      planId = rawPlanId;
    } else {
      const name = str(row.plan || row.planName);
      if (name) {
        const found = ctx.plansByName.get(normalizeName(name));
        if (!found) return fail(`Unknown plan: "${name}"`);
        planId = found.id;
      }
    }

    const description = str(row.description);
    const payload: CreatePayload = {
      title,
      typeId,
      ...(statusId ? { statusId } : {}),
      ...(priorityId ? { priorityId } : {}),
      ...(assigneeId ? { assigneeId } : {}),
      ...(description ? { description } : {}),
      ...(due.iso ? { dueDate: due.iso } : {}),
      ...(start.iso ? { startDate: start.iso } : {}),
      ...(hours.hours !== undefined ? { estimatedHours: hours.hours } : {}),
      ...(planId ? { planId } : {}),
    };
    return { index, title, payload, typeName, tagNames: splitTagNames(row.tags) };
  }
}

/** Pre-validate ID references of a bulk payload against project data (clear errors instead of FK violations). */
function validateBulkRefs(ctx: ImportContext, parsed: z.infer<typeof createItemSchema>): string | null {
  if (parsed.statusId && !ctx.statusesById.has(parsed.statusId)) return `Unknown statusId: "${parsed.statusId}"`;
  if (parsed.priorityId && !ctx.prioritiesById.has(parsed.priorityId)) {
    return `Unknown priorityId: "${parsed.priorityId}"`;
  }
  if (parsed.assigneeId && !ctx.membersById.has(parsed.assigneeId)) {
    return 'Assignee is not a project member';
  }
  if (parsed.planId && !ctx.plansById.has(parsed.planId)) return `Unknown planId: "${parsed.planId}"`;
  const badTag = parsed.tagIds?.find((id) => !ctx.tagsById.has(id));
  if (badTag) return `Unknown tagId: "${badTag}"`;
  return null;
}

function summarize(results: BulkItemResult[], flags: { dryRun: boolean; dedupe: boolean }): BulkMeta {  return {
    created: results.filter((r) => r.status === 'created').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    failed: results.filter((r) => r.status === 'failed').length,
    dryRun: flags.dryRun,
    dedupe: flags.dedupe,
  };
}

function titleOf(raw: unknown): string {
  if (raw && typeof raw === 'object' && 'title' in raw) return String((raw as { title: unknown }).title ?? '');
  return '';
}

function zodMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'issues' in err && Array.isArray((err as { issues: unknown[] }).issues)) {
    return (err as { issues: { path: (string | number)[]; message: string }[] }).issues
      .map((i) => `${i.path.join('.') || 'value'}: ${i.message}`)
      .join('; ');
  }
  return messageOf(err);
}

function messageOf(err: unknown): string {
  if (err instanceof Error) {
    const response = (err as Error & { response?: { message?: unknown } }).response;
    if (response && typeof response.message === 'string') return response.message;
    if (Array.isArray(response?.message)) return (response?.message as unknown[]).map(String).join('; ');
    return err.message;
  }
  return String(err);
}
