import { Injectable, BadRequestException } from '@nestjs/common';
import { getDb } from '../../database/client.js';
import { plans } from '../../database/schema/plans.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { createPlanSchema } from '@cordlyx/shared';
import { PlansService } from './plans.service.js';
import {
  TRANSFER_MAX_ROWS,
  normalizeName,
  parseTransferBuffer,
  summarizeTransfer,
  type TransferItemResult,
} from '../../common/transfer.util.js';

export const plansBulkSchema = z.object({
  items: z.array(z.unknown()).min(1).max(TRANSFER_MAX_ROWS),
  dedupe: z.boolean().optional().default(true),
  dryRun: z.boolean().optional().default(false),
});

const PLAN_CSV_HEADERS = ['Name', 'Type', 'Status', 'Description', 'Color', 'Start Date', 'End Date'];

function mapPlanHeaders(row: Record<string, string>): Record<string, unknown> {
  const get = (...keys: string[]): string => {
    for (const k of keys) {
      const v = row[k] ?? row[k.toLowerCase()] ?? '';
      if (v !== '') return v;
    }
    return '';
  };
  const out: Record<string, unknown> = {};
  const name = get('Name', 'Title', 'name', 'title');
  if (name) out.name = name;
  const type = get('Type', 'type');
  if (type) out.type = type;
  const status = get('Status', 'status');
  if (status) out.status = status;
  const description = get('Description', 'description');
  if (description) out.description = description;
  const color = get('Color', 'color');
  if (color) out.color = color;
  const startDate = get('Start Date', 'Start', 'startDate', 'start_date');
  if (startDate) out.startDate = startDate;
  const endDate = get('End Date', 'End', 'endDate', 'end_date');
  if (endDate) out.endDate = endDate;
  return out;
}

@Injectable()
export class PlansTransferService {
  constructor(private readonly plansService: PlansService) {}

  async exportAll(projectId: string, format: 'csv' | 'json' | 'jsonl') {
    const db = getDb();
    const rows = await db
      .select({
        name: plans.name,
        type: plans.type,
        status: plans.status,
        description: plans.description,
        color: plans.color,
        startDate: plans.startDate,
        endDate: plans.endDate,
      })
      .from(plans)
      .where(eq(plans.projectId, projectId))
      .orderBy(plans.sortOrder);

    if (format === 'json') return rows;
    if (format === 'jsonl') return rows.map((r) => JSON.stringify(r)).join('\n');

    const csvRows = rows.map((r) =>
      [r.name, r.type, r.status, r.description ?? '', r.color ?? '', r.startDate ?? '', r.endDate ?? '']
        .map((v) => {
          const s = String(v ?? '');
          return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(','),
    );
    return [PLAN_CSV_HEADERS.join(','), ...csvRows].join('\n');
  }

  async bulkCreate(
    projectId: string,
    rawItems: unknown[],
    opts?: { dedupe?: boolean; dryRun?: boolean },
  ): Promise<{ data: TransferItemResult[]; meta: { created: number; skipped: number; failed: number; dryRun: boolean; dedupe: boolean } }> {
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      throw new BadRequestException('Body must contain a non-empty "items" array');
    }
    if (rawItems.length > TRANSFER_MAX_ROWS) {
      throw new BadRequestException(`Too many items (max ${TRANSFER_MAX_ROWS} per request)`);
    }
    return this.execute(projectId, rawItems, opts);
  }

  async importFile(
    projectId: string,
    file: { originalname: string; buffer: Buffer },
    opts?: { dedupe?: boolean; dryRun?: boolean },
  ): Promise<{ data: TransferItemResult[]; meta: { created: number; skipped: number; failed: number; dryRun: boolean; dedupe: boolean; format: string } }> {
    const { format, rows } = parseTransferBuffer(file.buffer, file.originalname ?? '');
    const normalized = format === 'csv' ? rows.map((r) => mapPlanHeaders(r as Record<string, string>)) : rows;
    const { data, meta } = await this.execute(projectId, normalized, opts);
    return { data, meta: { ...meta, format } };
  }

  private async execute(
    projectId: string,
    rawItems: unknown[],
    opts?: { dedupe?: boolean; dryRun?: boolean },
  ): Promise<{ data: TransferItemResult[]; meta: { created: number; skipped: number; failed: number; dryRun: boolean; dedupe: boolean } }> {
    const db = getDb();
    const dedupe = opts?.dedupe !== false;
    const dryRun = opts?.dryRun === true;
    const existing = await db.select({ name: plans.name }).from(plans).where(eq(plans.projectId, projectId));
    const known = new Set(existing.map((p) => normalizeName(p.name)));
    const results: TransferItemResult[] = [];

    for (let index = 0; index < rawItems.length; index++) {
      const raw = stripNulls(rawItems[index]) as Record<string, unknown>;
      const withAlias =
        raw && typeof raw === 'object' && !Array.isArray(raw) && raw.name == null && raw.title != null
          ? { ...raw, name: raw.title }
          : raw;
      let parsed: z.infer<typeof createPlanSchema>;
      try {
        parsed = createPlanSchema.parse(withAlias);
      } catch (err) {
        results.push({ index, status: 'failed', title: planTitleOf(raw), error: zodMessage(err) });
        continue;
      }
      const key = normalizeName(parsed.name);
      if (dedupe && known.has(key)) {
        results.push({ index, status: 'skipped', title: parsed.name });
        continue;
      }
      known.add(key);
      if (dryRun) {
        results.push({ index, status: 'created', title: parsed.name });
        continue;
      }
      try {
        const created = await this.plansService.create(projectId, parsed);
        if (!created) throw new Error('Failed to create plan');
        results.push({ index, status: 'created', id: created.id, title: created.name, item: created });
      } catch (err) {
        results.push({ index, status: 'failed', title: parsed.name, error: messageOf(err) });
      }
    }
    return { data: results, meta: { ...summarizeTransfer(results), dryRun, dedupe } };
  }
}

/** createPlanSchema treats nulls as absent — drop explicit nulls so exports round-trip. */
function stripNulls(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v !== null) out[k] = v;
  }
  return out;
}

function planTitleOf(raw: unknown): string {
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    const v = r.name ?? r.title;
    if (v != null) return String(v);
  }
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
  return err instanceof Error ? err.message : String(err);
}
