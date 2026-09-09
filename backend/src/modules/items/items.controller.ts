import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  Res,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ApiKeyOrJwtAuthGuard, ProjectMembershipGuard, ProjectRoleGuard, MinimumRole, CurrentUser, type AuthenticatedUser } from '../../common/index.js';
import {
  ApiZodBody,
  ApiZodQuery,
  ApiProjectSlugParam,
  ApiUuidParam,
  ApiSequenceNumParam,
  ApiDedupeQuery,
  ApiDryRunQuery,
  ApiExportFormatQuery,
  ApiErrorResponses,
  ApiListResponse,
  ItemResponseDto,
} from '../../common/index.js';
import { ItemsService } from './items.service.js';
import { VotesService } from './votes.service.js';
import { ItemsImportService, bulkRequestSchema, IMPORT_MAX_BYTES } from './items-import.service.js';
import { EtagInterceptor } from '../../common/interceptors/etag.interceptor.js';
import { assertItemInProject } from '../../common/assert-item.js';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getDb } from '../../database/client.js';
import { users } from '../../database/schema/users.js';
import { itemStatuses, itemPriorities } from '../../database/schema/config.js';
import { plans } from '../../database/schema/plans.js';
import { itemTags, tags as tagsTable } from '../../database/schema/tags.js';
import { eq, and, inArray, sql, isNull } from 'drizzle-orm';
import { createItemSchema, updateItemSchema, itemFilterSchema } from '@cordlyx/shared';
import { items } from '../../database/schema/items.js';

@ApiTags('items')
@Controller('projects/:projectSlug/items')
@UseGuards(ApiKeyOrJwtAuthGuard, ProjectMembershipGuard)
export class ItemsController {
  constructor(
    private readonly itemsService: ItemsService,
    private readonly votesService: VotesService,
    private readonly eventEmitter: EventEmitter2,
    private readonly importService: ItemsImportService,
  ) {}

  @Get()
  @UseInterceptors(EtagInterceptor)
  @ApiOperation({ summary: 'List items (cursor pagination, filters). Supports If-None-Match/ETag.' })
  @ApiProjectSlugParam()
  @ApiZodQuery(itemFilterSchema)
  @ApiListResponse('Items, newest first by default.', {
    id: '00000000-0000-0000-0000-000000000001',
    sequenceNum: 1,
    title: 'Set up CI/CD pipeline',
  })
  @ApiErrorResponses(400, 401, 403, 404, 429)
  async list(@Req() req: Request, @Query() query: unknown) {
    const filters = itemFilterSchema.parse(query);
    return this.itemsService.list(req.projectId as string, filters);
  }

  @Get('export')
  @UseInterceptors(EtagInterceptor)
  @ApiOperation({ summary: 'Export project items as CSV, JSON or JSONL (?format=csv|json|jsonl)' })
  @ApiProjectSlugParam()
  @ApiExportFormatQuery()
  @ApiResponse({ status: 200, description: 'File download with Content-Disposition: attachment' })
  @ApiErrorResponses(401, 403, 404, 429)
  async export(
    @Param('projectSlug') slug: string,
    @Req() req: Request,
    @Query('format') format: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const fmt = format === 'json' || format === 'jsonl' ? format : 'csv';
    const body = await this.itemsService.exportAll(req.projectId as string, fmt);
    const ext = fmt === 'jsonl' ? 'jsonl' : fmt;
    res.set({
      'Content-Type':
        fmt === 'csv'
          ? 'text/csv; charset=utf-8'
          : fmt === 'json'
            ? 'application/json; charset=utf-8'
            : 'application/x-ndjson; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}-items.${ext}"`,
    });
    return typeof body === 'string' ? body : JSON.stringify(body, null, 2);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Create up to 100 items in one request (supports dedupe and dryRun)' })
  @ApiProjectSlugParam()
  @ApiZodBody(bulkRequestSchema, 'Items array (or raw array, normalized server-side).')
  @ApiDedupeQuery()
  @ApiDryRunQuery()
  @ApiResponse({ status: 201, description: 'Per-item results: created | skipped | failed' })
  @ApiErrorResponses(400, 401, 403, 429)
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async bulk(
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @Query('dedupe') dedupeQuery?: string,
    @Query('dryRun') dryRunQuery?: string,
  ) {
    const normalized = Array.isArray(body) ? { items: body } : body;
    const parsed = bulkRequestSchema.parse(normalized);
    const projectId = req.projectId as string;
    const { data, meta } = await this.importService.bulkCreate(projectId, user.id, parsed.items, {
      dedupe: parseFlag(dedupeQuery, parsed.dedupe),
      dryRun: parseFlag(dryRunQuery, parsed.dryRun),
    });
    if (!meta.dryRun) {
      for (const r of data) {
        if (r.status === 'created' && r.item) {
          this.eventEmitter.emit('item.created', { projectId, item: r.item, actorId: user.id });
        }
      }
    }
    return { data: stripInternal(data), meta };
  }

  @Post('import')
  @ApiOperation({ summary: 'Import items from a CSV, JSON or JSONL file (max 10 MB, 100 rows)' })
  @ApiProjectSlugParam()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiDedupeQuery()
  @ApiDryRunQuery()
  @ApiResponse({ status: 201, description: 'Per-row results: created | skipped | failed' })
  @ApiErrorResponses(400, 401, 403, 429)
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: IMPORT_MAX_BYTES } }))
  async import(
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('dedupe') dedupeQuery?: string,
    @Query('dryRun') dryRunQuery?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded (multipart field "file": .csv, .json or .jsonl, max 10 MB)');
    }
    const projectId = req.projectId as string;
    const { data, meta } = await this.importService.importFile(
      projectId,
      user.id,
      { originalname: file.originalname, buffer: file.buffer },
      {
        dedupe: parseFlag(dedupeQuery, true),
        dryRun: parseFlag(dryRunQuery, false),
      },
    );
    if (!meta.dryRun) {
      for (const r of data) {
        if (r.status === 'created' && r.item) {
          this.eventEmitter.emit('item.created', { projectId, item: r.item, actorId: user.id });
        }
      }
    }
    return { data: stripInternal(data), meta };
  }

  @Get('meta/children-counts')
  @ApiOperation({ summary: 'Children counts for given parent ids (?ids=a,b). Powers Tree expand chevrons.' })
  @ApiProjectSlugParam()
  @ApiResponse({ status: 200, description: 'Map of parent id to non-deleted children count.' })
  async childrenCounts(@Req() req: Request, @Query('ids') ids?: string) {
    const list = (ids ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 200);
    const counts = await this.itemsService.childrenCounts(req.projectId as string, list);
    return { data: counts };
  }

  @Get(':id/children')
  @ApiOperation({ summary: 'List direct children of one item (for Tree view drill-down)' })
  @ApiProjectSlugParam()
  @ApiUuidParam('id', 'Parent item id.')
  @ApiResponse({ status: 200, description: 'Direct non-deleted children, newest first (max 200).' })
  async listChildren(@Req() req: Request, @Param('id') id: string) {
    await assertItemInProject(req.projectId as string, id);
    return this.itemsService.listChildren(req.projectId as string, id);
  }

  @Get(':sequenceNum')
  @ApiOperation({ summary: 'Get one item by its sequence number' })
  @ApiProjectSlugParam()
  @ApiSequenceNumParam()
  @ApiResponse({ status: 200, description: 'The item.', type: ItemResponseDto })
  @ApiErrorResponses(400, 401, 403, 404, 429)
  async getBySequence(
    @Req() req: Request,
    @Param('sequenceNum', ParseIntPipe) sequenceNum: number,
  ) {
    const item = await this.itemsService.getBySequence(req.projectId as string, sequenceNum);
    if (!item) {
      const { NotFoundException } = await import('@nestjs/common');
      throw new NotFoundException('Item not found');
    }
    return item;
  }

  @Post()
  @ApiOperation({ summary: 'Create one item (sequence number assigned automatically)' })
  @ApiProjectSlugParam()
  @ApiZodBody(createItemSchema)
  @ApiResponse({ status: 201, description: 'The created item.', type: ItemResponseDto })
  @ApiErrorResponses(400, 401, 403, 404, 429)
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async create(
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const data = createItemSchema.parse(body);
    const item = (await this.itemsService.create(req.projectId as string, data, user.id))!;
    this.eventEmitter.emit('item.created', { projectId: req.projectId, item, actorId: user.id });
    if (item.assigneeId) {
      this.eventEmitter.emit('item.assigned', {
        projectId: req.projectId,
        item,
        oldAssigneeId: null,
        actorId: user.id,
      });
    }

    return item;
  }

  @Post('check-duplicates')
  @ApiOperation({ summary: 'Find existing items with a similar title (quick-create helper)' })
  @ApiProjectSlugParam()
  @ApiBody({
    description: 'Title to compare; empty title returns an empty list.',
    schema: { type: 'object', properties: { title: { type: 'string' } } },
  })
  @ApiResponse({ status: 200, description: '{ duplicates: [{ id, sequenceNum, title }] } (max 5).' })
  @ApiErrorResponses(401, 403, 429)
  async checkDuplicates(@Req() req: Request, @Body() body: { title?: string }) {
    if (!body.title?.trim()) return { duplicates: [] };
    try {
      const db = getDb();
      const dups = await db
        .select({ id: items.id, sequenceNum: items.sequenceNum, title: items.title })
        .from(items)
        .where(and(
          eq(items.projectId, req.projectId as string),
          sql`${items.title} ILIKE ${'%' + body.title.trim() + '%'}`,
          sql`${items.deletedAt} IS NULL`,
        ))
        .limit(5);
      return { duplicates: dups };
    } catch (err: any) {
      return { duplicates: [], error: err.message };
    }
  }

  @Post(':id/clone')
  @ApiOperation({ summary: 'Clone an item (new sequence number, same content)' })
  @ApiProjectSlugParam()
  @ApiUuidParam('id', 'Item id to clone.')
  @ApiResponse({ status: 201, description: 'The cloned item.', type: ItemResponseDto })
  @ApiErrorResponses(401, 403, 404, 429)
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async clone(
    @Req() req: Request,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const item = await this.itemsService.clone(req.projectId as string, id, user.id);
    this.eventEmitter.emit('item.created', { projectId: req.projectId, item, actorId: user.id });
    return item;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update item fields (partial)' })
  @ApiProjectSlugParam()
  @ApiUuidParam('id', 'Item id to update.')
  @ApiZodBody(updateItemSchema)
  @ApiResponse({ status: 200, description: 'The updated item.', type: ItemResponseDto })
  @ApiErrorResponses(400, 401, 403, 404, 429)
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const db = getDb();
    const data = updateItemSchema.parse(body);

    // Capture old tag names before update (service handles tagIds internally)
    let oldTagNames: string[] = [];
    if (data.tagIds !== undefined) {
      const oldTagRows = await db
        .select({ name: tagsTable.name })
        .from(itemTags)
        .innerJoin(tagsTable, eq(itemTags.tagId, tagsTable.id))
        .where(eq(itemTags.itemId, id));
      oldTagNames = oldTagRows.map((r) => r.name);
    }

    const { item, oldValues } = await this.itemsService.update(req.projectId as string, id, data);

    // Emit dedicated events for specific changes
    if (data.assigneeId !== undefined && data.assigneeId !== oldValues.assigneeId) {
      const [assigneeUser] = data.assigneeId
        ? await db.select({ name: users.name }).from(users).where(eq(users.id, data.assigneeId)).limit(1)
        : [];
      const [oldAssigneeUser] = oldValues.assigneeId
        ? await db.select({ name: users.name }).from(users).where(eq(users.id, oldValues.assigneeId)).limit(1)
        : [];
      this.eventEmitter.emit('item.assigned', {
        projectId: req.projectId,
        item,
        oldValue: oldAssigneeUser?.name ?? null,
        newValue: assigneeUser?.name ?? null,
        oldAssigneeId: oldValues.assigneeId,
        actorId: user.id,
      });
    }

    if (data.statusId !== undefined && data.statusId !== oldValues.statusId) {
      const [newStatus] = await db.select({ name: itemStatuses.name }).from(itemStatuses).where(eq(itemStatuses.id, data.statusId)).limit(1);
      const [oldStatus] = oldValues.statusId
        ? await db.select({ name: itemStatuses.name }).from(itemStatuses).where(eq(itemStatuses.id, oldValues.statusId)).limit(1)
        : [];
      this.eventEmitter.emit('item.status_changed', {
        projectId: req.projectId,
        item,
        oldValue: oldStatus?.name ?? null,
        newValue: newStatus?.name ?? null,
        actorId: user.id,
      });
    }

    // Emit general item.updated for each changed field (excluding assignee/status handled above)
    if (data.title !== undefined && data.title !== oldValues.title) {
      this.eventEmitter.emit('item.updated', {
        projectId: req.projectId,
        item,
        fieldName: 'title',
        oldValue: oldValues.title,
        newValue: data.title,
        actorId: user.id,
      });
    }
    if (data.description !== undefined && data.description !== oldValues.description) {
      this.eventEmitter.emit('item.updated', {
        projectId: req.projectId,
        item,
        fieldName: 'description',
        oldValue: oldValues.description,
        newValue: data.description,
        actorId: user.id,
      });
    }
    if (data.priorityId !== undefined && data.priorityId !== oldValues.priorityId) {
      const [newPriority] = await db.select({ name: itemPriorities.name }).from(itemPriorities).where(eq(itemPriorities.id, data.priorityId)).limit(1);
      const [oldPriority] = oldValues.priorityId
        ? await db.select({ name: itemPriorities.name }).from(itemPriorities).where(eq(itemPriorities.id, oldValues.priorityId)).limit(1)
        : [];
      this.eventEmitter.emit('item.updated', {
        projectId: req.projectId,
        item,
        fieldName: 'priority',
        oldValue: oldPriority?.name ?? null,
        newValue: newPriority?.name ?? null,
        actorId: user.id,
      });
    }

    if (data.planId !== undefined && data.planId !== oldValues.planId) {
      const [newPlan] = data.planId
        ? await db.select({ name: plans.name }).from(plans).where(eq(plans.id, data.planId)).limit(1)
        : [];
      const [oldPlan] = oldValues.planId
        ? await db.select({ name: plans.name }).from(plans).where(eq(plans.id, oldValues.planId)).limit(1)
        : [];
      this.eventEmitter.emit('item.updated', {
        projectId: req.projectId,
        item,
        fieldName: 'plan',
        oldValue: oldPlan?.name ?? null,
        newValue: newPlan?.name ?? null,
        actorId: user.id,
      });
    }

    // Emit tag changes
    if (data.tagIds !== undefined) {
      const newTagRows = await db
        .select({ name: tagsTable.name })
        .from(tagsTable)
        .where(inArray(tagsTable.id, data.tagIds));
      const newTagNames = newTagRows.map((r) => r.name);
      if (oldTagNames.join(',') !== newTagNames.join(',')) {
        this.eventEmitter.emit('item.updated', {
          projectId: req.projectId,
          item,
          fieldName: 'tags',
          oldValue: oldTagNames.length > 0 ? oldTagNames.join(', ') : null,
          newValue: newTagNames.length > 0 ? newTagNames.join(', ') : null,
          actorId: user.id,
        });
      }
    }

    return item;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete an item' })
  @ApiProjectSlugParam()
  @ApiUuidParam('id', 'Item id to delete.')
  @ApiResponse({ status: 200, description: 'Deletion result.' })
  @ApiErrorResponses(401, 403, 404, 429)
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async delete(
    @Param('id') id: string,
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.itemsService.softDelete(req.projectId as string, id);
    this.eventEmitter.emit('item.deleted', { projectId: req.projectId, itemId: id, title: result.title, actorId: user.id });
    return result;
  }

  @Post(':id/vote')
  @ApiOperation({ summary: 'Toggle your vote on an item' })
  @ApiProjectSlugParam()
  @ApiUuidParam('id', 'Item id to vote on.')
  @ApiResponse({ status: 201, description: '{ voted: true | false }.' })
  @ApiErrorResponses(401, 403, 404, 429)
  async toggleVote(
    @Param('id') id: string,
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.votesService.toggle(req.projectId as string, id, user.id);
    this.eventEmitter.emit(result.voted ? 'item.vote_added' : 'item.vote_removed', {
      projectId: req.projectId, itemId: id, actorId: user.id,
    });
    return result;
  }

  @Get(':id/votes')
  @ApiOperation({ summary: 'List votes on an item' })
  @ApiProjectSlugParam()
  @ApiUuidParam('id', 'Item id.')
  @ApiResponse({ status: 200, description: 'Vote list.' })
  @ApiErrorResponses(401, 403, 404, 429)
  async getVotes(@Req() req: Request, @Param('id') id: string) {
    await assertItemInProject(req.projectId as string, id);
    return this.votesService.getVotes(id);
  }
}

function parseFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const v = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return fallback;
}

function stripInternal(results: { item?: unknown }[]) {
  return results.map(({ item: _item, ...rest }) => rest);
}
