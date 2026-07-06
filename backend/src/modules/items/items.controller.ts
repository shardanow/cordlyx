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
  Req,
  Res,
  Header,
  ParseIntPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, ProjectMembershipGuard, ProjectRoleGuard, MinimumRole, CurrentUser, type AuthenticatedUser } from '../../common/index.js';
import { ItemsService } from './items.service.js';
import { VotesService } from './votes.service.js';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getDb } from '../../database/client.js';
import { users } from '../../database/schema/users.js';
import { itemStatuses, itemPriorities } from '../../database/schema/config.js';
import { plans } from '../../database/schema/plans.js';
import { itemTags, tags as tagsTable } from '../../database/schema/tags.js';
import { eq, and, inArray, sql, isNull, ne } from 'drizzle-orm';
import { createItemSchema, updateItemSchema, itemFilterSchema } from '@cordlyx/shared';
import { items } from '../../database/schema/items.js';

@Controller('projects/:projectSlug/items')
@UseGuards(JwtAuthGuard, ProjectMembershipGuard)
export class ItemsController {
  constructor(
    private readonly itemsService: ItemsService,
    private readonly votesService: VotesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Get()
  async list(@Req() req: Request, @Query() query: unknown) {
    const filters = itemFilterSchema.parse(query);
    return this.itemsService.list(req.projectId as string, filters);
  }

  @Get('export')
  @Header('Content-Disposition', 'attachment')
  async export(
    @Param('projectSlug') slug: string,
    @Req() req: Request,
    @Query('format') format: string,
  ) {
    return this.itemsService.exportAll(req.projectId as string, (format as 'csv' | 'json' | 'jsonl') || 'csv');
  }

  @Get(':sequenceNum')
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
  async getVotes(@Param('id') id: string) {
    return this.votesService.getVotes(id);
  }
}
