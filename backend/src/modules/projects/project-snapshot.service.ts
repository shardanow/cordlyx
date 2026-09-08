import { Injectable, BadRequestException } from '@nestjs/common';
import { getDb } from '../../database/client.js';
import { projects } from '../../database/schema/projects.js';
import { items } from '../../database/schema/items.js';
import { itemTypes, itemStatuses, itemPriorities } from '../../database/schema/config.js';
import { users } from '../../database/schema/users.js';
import { plans } from '../../database/schema/plans.js';
import { tags as tagsTable, itemTags } from '../../database/schema/tags.js';
import { itemRelations, relationTypes } from '../../database/schema/relations.js';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { ProjectsService } from './projects.service.js';
import { ProjectConfigTransferService } from './project-config-transfer.service.js';
import { PlansTransferService } from '../plans/plans-transfer.service.js';
import { ItemsImportService, dedupeKey } from '../items/items-import.service.js';
import { RoadmapsTransferService, type RoadmapExport } from '../roadmaps/roadmaps-transfer.service.js';
import { migrateSnapshot } from './snapshot-migration.js';

export const SNAPSHOT_VERSION = 1;
/** Max items per snapshot import (processed in chunks of 100). */
export const SNAPSHOT_MAX_ITEMS = 2000;
const ITEM_CHUNK = 100;

const snapshotSchema = z.object({
  version: z.literal(SNAPSHOT_VERSION),
  project: z.object({
    name: z.string().min(1).max(200),
    slug: z.string().min(1).max(200),
    description: z.string().max(10000).nullable().optional(),
  }),
  config: z
    .object({
      types: z.array(z.unknown()).optional().default([]),
      statuses: z.array(z.unknown()).optional().default([]),
      priorities: z.array(z.unknown()).optional().default([]),
      tags: z.array(z.unknown()).optional().default([]),
    })
    .optional()
    .default({}),
  plans: z.array(z.unknown()).optional().default([]),
  items: z.array(z.unknown()).optional().default([]),
  relations: z.array(z.unknown()).optional().default([]),
  roadmaps: z.array(z.unknown()).optional().default([]),
});

export type SnapshotJson = z.infer<typeof snapshotSchema> & {
  exportedAt: string;
  roadmaps: RoadmapExport[];
};

export interface SnapshotImportSection {
  created: number;
  skipped: number;
  failed: number;
}

@Injectable()
export class ProjectSnapshotService {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly configTransfer: ProjectConfigTransferService,
    private readonly plansTransfer: PlansTransferService,
    private readonly itemsImport: ItemsImportService,
    private readonly roadmapsTransfer: RoadmapsTransferService,
  ) {}

  async exportSnapshot(projectId: string): Promise<SnapshotJson> {
    const db = getDb();
    const [projRow] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    const [config, planRows, roadmaps] = await Promise.all([
      this.configTransfer.exportConfig(projectId),
      db.select().from(plans).where(eq(plans.projectId, projectId)).orderBy(plans.sortOrder),
      this.roadmapsTransfer.exportAll(projectId, 'json') as Promise<RoadmapExport[]>,
    ]);

    const itemRows = await db
      .select({
        id: items.id,
        sequenceNum: items.sequenceNum,
        title: items.title,
        description: items.description,
        typeName: itemTypes.name,
        statusName: itemStatuses.name,
        priorityName: itemPriorities.name,
        assigneeEmail: users.email,
        planName: plans.name,
        dueDate: items.dueDate,
        startDate: items.startDate,
        estimatedHours: items.estimatedHours,
      })
      .from(items)
      .leftJoin(itemTypes, eq(items.typeId, itemTypes.id))
      .leftJoin(itemStatuses, eq(items.statusId, itemStatuses.id))
      .leftJoin(itemPriorities, eq(items.priorityId, itemPriorities.id))
      .leftJoin(users, eq(items.assigneeId, users.id))
      .leftJoin(plans, eq(items.planId, plans.id))
      .where(and(eq(items.projectId, projectId), isNull(items.deletedAt)))
      .orderBy(items.sequenceNum);

    const itemIds = itemRows.map((r) => r.id);
    const tagMap = new Map<string, string[]>();
    if (itemIds.length > 0) {
      const tagRows = await db
        .select({ itemId: itemTags.itemId, name: tagsTable.name })
        .from(itemTags)
        .innerJoin(tagsTable, eq(itemTags.tagId, tagsTable.id))
        .where(inArray(itemTags.itemId, itemIds));
      for (const t of tagRows) {
        const list = tagMap.get(t.itemId) ?? [];
        list.push(t.name);
        tagMap.set(t.itemId, list);
      }
    }

    const idToSeq = new Map(itemRows.map((r) => [r.id, Number(r.sequenceNum)]));
    const relRows =
      itemIds.length > 0
        ? await db.select().from(itemRelations).where(inArray(itemRelations.sourceItemId, itemIds))
        : [];

    return {
      version: SNAPSHOT_VERSION,
      exportedAt: new Date().toISOString(),
      project: {
        name: projRow?.name ?? 'project',
        slug: projRow?.slug ?? 'project',
        description: projRow?.description ?? null,
      },
      config: {
        types: config.types,
        statuses: config.statuses,
        priorities: config.priorities,
        tags: config.tags,
      },
      plans: planRows.map((p) => ({
        name: p.name,
        type: p.type,
        status: p.status,
        description: p.description,
        color: p.color,
      })),
      items: itemRows.map((r) => ({
        sequenceNum: Number(r.sequenceNum),
        title: r.title,
        description: r.description,
        type: r.typeName,
        status: r.statusName,
        priority: r.priorityName,
        assignee: r.assigneeEmail,
        dueDate: r.dueDate?.toISOString() ?? null,
        startDate: r.startDate?.toISOString() ?? null,
        estimatedHours: r.estimatedHours != null ? Number(r.estimatedHours) : null,
        tags: tagMap.get(r.id) ?? [],
        plan: r.planName,
      })),
      relations: relRows
        .filter((rel) => idToSeq.has(rel.sourceItemId) && idToSeq.has(rel.targetItemId))
        .map((rel) => ({
          sourceSeq: idToSeq.get(rel.sourceItemId)!,
          targetSeq: idToSeq.get(rel.targetItemId)!,
          relationType: rel.relationType,
        })),
      roadmaps,
    };
  }

  async importSnapshot(
    projectId: string,
    raw: unknown,
    opts?: { dryRun?: boolean; dedupe?: boolean; reporterId?: string },
  ): Promise<{ data: Record<string, unknown>; meta: { dryRun: boolean; sections: Record<string, SnapshotImportSection> } }> {
    const snapshot = snapshotSchema.parse(migrateSnapshot(raw));
    const dryRun = opts?.dryRun === true;
    const dedupe = opts?.dedupe !== false;
    const reporterId = opts?.reporterId;
    if (snapshot.items.length > SNAPSHOT_MAX_ITEMS) {
      throw new BadRequestException(`Too many items in snapshot (max ${SNAPSHOT_MAX_ITEMS})`);
    }
    const sections: Record<string, SnapshotImportSection> = {};

    // 1. Config (upsert by name).
    const configRes = await this.configTransfer.importConfig(projectId, snapshot.config, { dryRun });
    sections.config = {
      created: configRes.meta.created,
      skipped: configRes.meta.unchanged,
      failed: configRes.meta.failed,
    };

    // 2. Plans (skip when empty — bulk endpoints require non-empty input).
    const plansRes =
      snapshot.plans.length > 0
        ? await this.plansTransfer.bulkCreate(projectId, snapshot.plans, { dedupe, dryRun })
        : { data: [], meta: { created: 0, skipped: 0, failed: 0, dryRun, dedupe } };
    sections.plans = { created: plansRes.meta.created, skipped: plansRes.meta.skipped, failed: plansRes.meta.failed };

    // 3. Items (chunked; rows carry name-based references).
    const itemRows = (snapshot.items as Record<string, unknown>[]).map((r) => ({
      title: r.title,
      description: r.description,
      type: r.type,
      status: r.status,
      priority: r.priority,
      assignee: r.assignee,
      dueDate: r.dueDate,
      startDate: r.startDate,
      estimatedHours: r.estimatedHours,
      tags: r.tags,
      plan: r.plan,
    }));
    const itemResults: { status: string }[] = [];
    for (let i = 0; i < itemRows.length; i += ITEM_CHUNK) {
      const chunk = itemRows.slice(i, i + ITEM_CHUNK);
      const buffer = Buffer.from(JSON.stringify(chunk));
      const res = await this.itemsImport.importFile(
        projectId,
        reporterId ?? (await this.ownerOf(projectId)),
        { originalname: 'snapshot.json', buffer },
        { dedupe, dryRun },
      );
      itemResults.push(...res.data);
    }
    sections.items = {
      created: itemResults.filter((r) => r.status === 'created').length,
      skipped: itemResults.filter((r) => r.status === 'skipped').length,
      failed: itemResults.filter((r) => r.status === 'failed').length,
    };

    // Map snapshot sequence numbers → current items (via dedupe keys).
    const itemMap = await this.buildItemMap(projectId, snapshot.items as Record<string, unknown>[]);
    const seqToId = new Map([...itemMap].map(([seq, v]) => [seq, v.id] as const));

    // 4. Relations.
    sections.relations = dryRun
      ? this.previewRelations(snapshot.relations as Record<string, unknown>[], seqToId)
      : await this.importRelations(seqToId, snapshot.relations as Record<string, unknown>[]);

    // 5. Roadmaps (entries remapped oldSeq → newSeq; skip when empty).
    const snapshotRoadmaps = snapshot.roadmaps as RoadmapExport[];
    const roadmapsRes =
      snapshotRoadmaps.length > 0
        ? await this.roadmapsTransfer.importRoadmaps(
            projectId,
            snapshotRoadmaps.map((rm) => ({
              ...rm,
              entries: (rm.entries ?? []).map((e) => ({ ...e, itemSeq: itemMap.get(e.itemSeq)?.sequenceNum ?? -1 })),
            })),
            { dedupe, dryRun },
          )
        : { data: [], meta: { created: 0, skipped: 0, failed: 0, dryRun, dedupe } };
    sections.roadmaps = {
      created: roadmapsRes.meta.created,
      skipped: roadmapsRes.meta.skipped,
      failed: roadmapsRes.meta.failed,
    };

    return {
      data: {
        config: configRes.data,
        plans: plansRes.data,
        items: itemResults,
        relations: sections.relations,
        roadmaps: roadmapsRes.data,
      },
      meta: { dryRun, sections },
    };
  }

  async importFile(
    projectId: string,
    file: { originalname: string; buffer: Buffer },
    opts?: { dryRun?: boolean; dedupe?: boolean; reporterId?: string },
  ) {
    if (file.buffer.length > 10 * 1024 * 1024) {
      throw new BadRequestException('File is too large (max 10 MB)');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(file.buffer.toString('utf-8'));
    } catch {
      throw new BadRequestException('Invalid snapshot JSON file (snapshots are JSON only)');
    }
    return this.importSnapshot(projectId, parsed, opts);
  }

  /** Create a new project from a snapshot (unique slug) and import into it. */
  async importNewProject(
    userId: string,
    raw: unknown,
    opts?: { slug?: string; name?: string; dryRun?: boolean; dedupe?: boolean },
  ): Promise<{ project: { id: string; name: string; slug: string }; import: unknown }> {
    const snapshot = snapshotSchema.parse(migrateSnapshot(raw));
    const baseName = opts?.name?.trim() || `${snapshot.project.name} (imported)`;
    const baseSlug = slugify(opts?.slug?.trim() || `${snapshot.project.slug}-imported`);
    let slug = baseSlug;
    for (let n = 2; await this.projectsService.getBySlug(slug); n++) {
      slug = `${baseSlug}-${n}`;
    }
    if (opts?.dryRun === true) {
      // Validate only: report what a fresh import would do without creating anything.
      return {
        project: { id: '', name: baseName, slug },
        import: { dryRun: true, note: 'Validation passed. Re-run without dryRun to create the project.' },
      };
    }
    const project = (await this.projectsService.create({ name: baseName, slug }, userId))!;
    try {
      const result = await this.importSnapshot(project.id, snapshot, { dedupe: opts?.dedupe, dryRun: false, reporterId: userId });
      return { project: { id: project.id, name: project.name, slug: project.slug }, import: result };
    } catch (err) {
      // Compensate: never leave a half-imported orphan project behind.
      await this.projectsService.softDelete(project.slug).catch(() => {});
      throw err;
    }
  }

  // --- internals ---

  /** Fallback reporter for snapshot-created items: the project owner. */
  private async ownerOf(projectId: string): Promise<string> {
    const db = getDb();
    const [row] = await db.select({ ownerId: projects.ownerId }).from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!row?.ownerId) throw new BadRequestException('Project not found');
    return row.ownerId;
  }

  /** Map snapshot item sequence numbers to current items ({id, sequenceNum}) in the target project. */
  private async buildItemMap(
    projectId: string,
    snapshotItems: Record<string, unknown>[],
  ): Promise<Map<number, { id: string; sequenceNum: number }>> {
    const db = getDb();
    const [types, current] = await Promise.all([
      db.select().from(itemTypes).where(eq(itemTypes.projectId, projectId)),
      db
        .select({ id: items.id, title: items.title, typeId: items.typeId, sequenceNum: items.sequenceNum })
        .from(items)
        .where(and(eq(items.projectId, projectId), isNull(items.deletedAt))),
    ]);
    const typeNameById = new Map(types.map((t) => [t.id, t.name]));
    const byKey = new Map(
      current.map((i) => [dedupeKey(i.title, typeNameById.get(i.typeId) ?? ''), i] as const),
    );
    const out = new Map<number, { id: string; sequenceNum: number }>();
    for (const r of snapshotItems) {
      const key = dedupeKey(String(r.title ?? ''), String(r.type ?? 'Task'));
      const found = byKey.get(key);
      const seq = Number(r.sequenceNum);
      if (found && Number.isFinite(seq)) out.set(seq, { id: found.id, sequenceNum: Number(found.sequenceNum) });
    }
    return out;
  }

  private previewRelations(
    rows: Record<string, unknown>[],
    seqToId: Map<number, string>,
  ): SnapshotImportSection {
    let created = 0;
    let failed = 0;
    for (const r of rows) {
      if (!isRelationType(r.relationType) || !seqToId.has(Number(r.sourceSeq)) || !seqToId.has(Number(r.targetSeq))) {
        failed++;
      } else {
        created++;
      }
    }
    return { created, skipped: 0, failed };
  }

  private async importRelations(
    seqToId: Map<number, string>,
    rows: Record<string, unknown>[],
  ): Promise<SnapshotImportSection> {
    const db = getDb();
    let created = 0;
    let skipped = 0;
    let failed = 0;
    for (const r of rows) {
      const sourceId = seqToId.get(Number(r.sourceSeq));
      const targetId = seqToId.get(Number(r.targetSeq));
      if (!isRelationType(r.relationType) || !sourceId || !targetId) {
        failed++;
        continue;
      }
      try {
        const existing = await db
          .select({ id: itemRelations.id })
          .from(itemRelations)
          .where(
            and(
              eq(itemRelations.sourceItemId, sourceId),
              eq(itemRelations.targetItemId, targetId),
              eq(itemRelations.relationType, r.relationType as string),
            ),
          )
          .limit(1);
        if (existing[0]) {
          skipped++;
          continue;
        }
        await db
          .insert(itemRelations)
          .values({ sourceItemId: sourceId, targetItemId: targetId, relationType: r.relationType as string })
          .onConflictDoNothing();
        created++;
      } catch {
        failed++;
      }
    }
    return { created, skipped, failed };
  }
}

function isRelationType(value: unknown): value is (typeof relationTypes)[number] {
  return typeof value === 'string' && (relationTypes as readonly string[]).includes(value);
}

function slugify(value: string): string {
  const clean = value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
  return clean || 'project';
}
