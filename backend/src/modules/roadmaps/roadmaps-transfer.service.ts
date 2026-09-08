import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { getDb } from '../../database/client.js';
import { roadmaps } from '../../database/schema/roadmaps.js';
import { roadmapLanes } from '../../database/schema/roadmap-lanes.js';
import { roadmapItems } from '../../database/schema/roadmap-items.js';
import { items } from '../../database/schema/items.js';
import { eq, and, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { createRoadmapSchema } from '@cordlyx/shared';
import { RoadmapsService } from './roadmaps.service.js';
import {
  TRANSFER_MAX_ROWS,
  TRANSFER_MAX_BYTES,
  normalizeName,
  parseTransferBuffer,
  type TransferStatus,
} from '../../common/transfer.util.js';

export interface RoadmapExportEntry {
  itemSeq: number;
  lane: string | null;
  startDate: string | null;
  dueDate: string | null;
  sortOrder: number;
}

export interface RoadmapExport {
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  color: string | null;
  sortOrder: number;
  lanes: { name: string; icon: string | null; color: string | null; sortOrder: number }[];
  entries: RoadmapExportEntry[];
}

export interface RoadmapImportResult {
  index: number;
  status: TransferStatus;
  id?: string;
  title: string;
  entries?: { created: number; skipped: number; failed: number };
  entryErrors?: string[];
  error?: string;
}

const roadmapCsvHeaders = ['Name', 'Description', 'Start Date', 'End Date', 'Color'];

function mapRoadmapHeaders(row: Record<string, string>): Record<string, unknown> {
  const get = (...keys: string[]): string => {
    for (const k of keys) {
      const v = row[k] ?? '';
      if (v !== '') return v;
    }
    return '';
  };
  const out: Record<string, unknown> = {};
  const name = get('Name', 'Title', 'name', 'title');
  if (name) out.name = name;
  const description = get('Description', 'description');
  if (description) out.description = description;
  const startDate = get('Start Date', 'startDate', 'start_date');
  if (startDate) out.startDate = startDate;
  const endDate = get('End Date', 'endDate', 'end_date');
  if (endDate) out.endDate = endDate;
  const color = get('Color', 'color');
  if (color) out.color = color;
  return out;
}

@Injectable()
export class RoadmapsTransferService {
  constructor(private readonly roadmapsService: RoadmapsService) {}

  async exportRoadmap(projectId: string, roadmapId: string): Promise<RoadmapExport> {
    const roadmap = await this.roadmapsService.getById(projectId, roadmapId);
    if (!roadmap) throw new NotFoundException('Roadmap not found');
    return this.toExport(roadmap);
  }

  async exportAll(projectId: string, format: 'csv' | 'json'): Promise<RoadmapExport[] | string> {
    const db = getDb();
    const all = await db
      .select()
      .from(roadmaps)
      .where(eq(roadmaps.projectId, projectId))
      .orderBy(roadmaps.sortOrder);
    if (format === 'csv') {
      const rows = all.map((r) =>
        [r.name, r.description ?? '', r.startDate, r.endDate, r.color ?? '']
          .map((v) => {
            const s = String(v ?? '');
            return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(','),
      );
      return [roadmapCsvHeaders.join(','), ...rows].join('\n');
    }
    const out: RoadmapExport[] = [];
    for (const r of all) out.push(await this.toExport(r));
    return out;
  }

  async importRoadmaps(
    projectId: string,
    raw: unknown,
    opts?: { dedupe?: boolean; dryRun?: boolean },
  ): Promise<{ data: RoadmapImportResult[]; meta: { created: number; skipped: number; failed: number; dryRun: boolean; dedupe: boolean } }> {
    const list = Array.isArray(raw) ? raw : [raw];
    if (list.length === 0) throw new BadRequestException('No roadmaps to import');
    if (list.length > TRANSFER_MAX_ROWS) {
      throw new BadRequestException(`Too many roadmaps (max ${TRANSFER_MAX_ROWS} per import)`);
    }
    const db = getDb();
    const dedupe = opts?.dedupe !== false;
    const dryRun = opts?.dryRun === true;

    const existingRoadmaps = await db.select({ name: roadmaps.name }).from(roadmaps).where(eq(roadmaps.projectId, projectId));
    const knownRoadmaps = new Set(existingRoadmaps.map((r) => normalizeName(r.name)));
    const projectItems = await db
      .select({ id: items.id, sequenceNum: items.sequenceNum })
      .from(items)
      .where(and(eq(items.projectId, projectId), isNull(items.deletedAt)));
    const itemBySeq = new Map(projectItems.map((i) => [Number(i.sequenceNum), i.id]));

    const results: RoadmapImportResult[] = [];
    for (let index = 0; index < list.length; index++) {
      const row = list[index] as Record<string, unknown>;
      const withAlias =
        row && typeof row === 'object' && !Array.isArray(row) && row.name == null && row.title != null
          ? { ...row, name: row.title }
          : row;
      let header: z.infer<typeof createRoadmapSchema>;
      try {
        header = createRoadmapSchema.parse(withAlias);
      } catch (err) {
        results.push({ index, status: 'failed', title: titleOf(row), error: zodMessage(err) });
        continue;
      }
      const key = normalizeName(header.name);
      if (dedupe && knownRoadmaps.has(key)) {
        results.push({ index, status: 'skipped', title: header.name });
        continue;
      }
      knownRoadmaps.add(key);

      const lanes = normalizeLanes(objOf(withAlias).lanes);
      const entries = normalizeEntries(objOf(withAlias).entries);
      if (dryRun) {
        const resolvable = entries.filter((e) => itemBySeq.has(e.itemSeq)).length;
        results.push({
          index,
          status: 'created',
          title: header.name,
          entries: { created: resolvable, skipped: 0, failed: entries.length - resolvable },
        });
        continue;
      }
      try {
        const created = await this.roadmapsService.create(projectId, {
          name: header.name,
          description: header.description,
          startDate: header.startDate,
          endDate: header.endDate,
          color: header.color,
          sortOrder: header.sortOrder,
        });
        if (!created) throw new Error('Failed to create roadmap');
        const laneByName = new Map<string, string>();
        for (const lane of lanes) {
          const createdLane = await this.roadmapsService.createLane(created.id, projectId, {
            name: lane.name,
            color: lane.color,
            sortOrder: lane.sortOrder,
          });
          if (createdLane) laneByName.set(normalizeName(lane.name), createdLane.id);
        }
        const entryStats = { created: 0, skipped: 0, failed: 0 };
        const entryErrors: string[] = [];
        for (const e of entries) {
          const itemId = itemBySeq.get(e.itemSeq);
          if (!itemId) {
            entryStats.failed++;
            if (entryErrors.length < 10) entryErrors.push(`item #${e.itemSeq} not found in project`);
            continue;
          }
          const laneId = e.lane ? (laneByName.get(normalizeName(e.lane)) ?? null) : null;
          if (e.lane && !laneId) {
            entryStats.failed++;
            if (entryErrors.length < 10) entryErrors.push(`lane "${e.lane}" not found`);
            continue;
          }
          const start = parseDateTime(e.startDate);
          const due = parseDateTime(e.dueDate);
          if ((e.startDate && !start) || (e.dueDate && !due)) {
            entryStats.failed++;
            if (entryErrors.length < 10) entryErrors.push(`item #${e.itemSeq}: invalid date`);
            continue;
          }
          const existing = await db
            .select({ id: roadmapItems.id })
            .from(roadmapItems)
            .where(and(eq(roadmapItems.roadmapId, created.id), eq(roadmapItems.itemId, itemId)))
            .limit(1);
          if (existing[0]) {
            entryStats.skipped++;
            continue;
          }
          await db.insert(roadmapItems).values({
            roadmapId: created.id,
            itemId,
            laneId,
            startDate: start,
            dueDate: due,
            sortOrder: typeof e.sortOrder === 'number' ? e.sortOrder : 0,
          });
          entryStats.created++;
        }
        const result: RoadmapImportResult = { index, status: 'created', id: created.id, title: created.name, entries: entryStats };
        if (entryErrors.length > 0) result.entryErrors = entryErrors;
        results.push(result);
      } catch (err) {
        results.push({ index, status: 'failed', title: header.name, error: messageOf(err) });
      }
    }
    return {
      data: results,
      meta: {
        created: results.filter((r) => r.status === 'created').length,
        skipped: results.filter((r) => r.status === 'skipped').length,
        failed: results.filter((r) => r.status === 'failed').length,
        dryRun,
        dedupe,
      },
    };
  }

  async importFile(
    projectId: string,
    file: { originalname: string; buffer: Buffer },
    opts?: { dedupe?: boolean; dryRun?: boolean },
  ) {
    if (file.buffer.length > TRANSFER_MAX_BYTES) {
      throw new BadRequestException('File is too large (max 10 MB)');
    }
    // Accept a single roadmap object as well as an array.
    const content = file.buffer.toString('utf-8').trimStart();
    if (content.startsWith('{')) {
      let obj: unknown;
      try {
        obj = JSON.parse(content);
      } catch {
        throw new BadRequestException('Invalid JSON file');
      }
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        const { data, meta } = await this.importRoadmaps(projectId, obj, opts);
        return { data, meta: { ...meta, format: 'json' as const } };
      }
    }
    const { format, rows } = parseTransferBuffer(file.buffer, file.originalname ?? '');
    if (format === 'csv') {
      return this.importRoadmaps(projectId, rows.map((r) => mapRoadmapHeaders(r as Record<string, string>)), opts);
    }
    const firstRow = rows[0];
    const payload = format === 'json' && rows.length === 1 && firstRow && isRoadmapExport(firstRow) ? firstRow : rows;
    const { data, meta } = await this.importRoadmaps(projectId, payload, opts);
    return { data, meta: { ...meta, format } };
  }

  private async toExport(roadmap: typeof roadmaps.$inferSelect): Promise<RoadmapExport> {
    const db = getDb();
    const laneRows = await db
      .select()
      .from(roadmapLanes)
      .where(eq(roadmapLanes.roadmapId, roadmap.id))
      .orderBy(roadmapLanes.sortOrder);
    const laneById = new Map(laneRows.map((l) => [l.id, l.name]));
    const entryRows = await db
      .select({ ri: roadmapItems, seq: items.sequenceNum })
      .from(roadmapItems)
      .innerJoin(items, eq(roadmapItems.itemId, items.id))
      .where(and(eq(roadmapItems.roadmapId, roadmap.id), isNull(items.deletedAt)))
      .orderBy(roadmapItems.sortOrder);
    return {
      name: roadmap.name,
      description: roadmap.description,
      startDate: roadmap.startDate,
      endDate: roadmap.endDate,
      color: roadmap.color,
      sortOrder: roadmap.sortOrder,
      lanes: laneRows.map((l) => ({ name: l.name, icon: l.icon, color: l.color, sortOrder: l.sortOrder })),
      entries: entryRows.map((r) => ({
        itemSeq: Number(r.seq),
        lane: r.ri.laneId ? (laneById.get(r.ri.laneId) ?? null) : null,
        startDate: r.ri.startDate?.toISOString() ?? null,
        dueDate: r.ri.dueDate?.toISOString() ?? null,
        sortOrder: r.ri.sortOrder,
      })),
    };
  }
}

function normalizeLanes(value: unknown): { name: string; icon?: string | null; color?: string | null; sortOrder?: number }[] {
  if (!Array.isArray(value)) return [];
  return (value as Record<string, unknown>[])
    .filter((l): l is Record<string, unknown> => !!l && typeof l === 'object')
    .map((l, i) => ({ name: String(l.name ?? '').trim(), icon: (l.icon as string | null) ?? null, color: (l.color as string | null) ?? null, sortOrder: typeof l.sortOrder === 'number' ? (l.sortOrder as number) : i }))
    .filter((l) => l.name !== '');
}

function normalizeEntries(value: unknown): { itemSeq: number; lane?: string | null; startDate?: string | null; dueDate?: string | null; sortOrder?: number }[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .map((e) => ({
      itemSeq: Number((e.itemSeq ?? e.sequenceNum) as unknown),
      lane: (e.lane as string | null) ?? null,
      startDate: (e.startDate as string | null) ?? null,
      dueDate: (e.dueDate as string | null) ?? null,
      sortOrder: typeof e.sortOrder === 'number' ? (e.sortOrder as number) : 0,
    }))
    .filter((e) => Number.isFinite(e.itemSeq));
}

function isRoadmapExport(row: Record<string, unknown>): boolean {
  return Array.isArray(row.lanes) || Array.isArray(row.entries);
}

function parseDateTime(value: string | null | undefined): Date | null {
  if (value == null || value === '') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function objOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function titleOf(row: unknown): string {
  if (row && typeof row === 'object') {
    const r = row as Record<string, unknown>;
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
