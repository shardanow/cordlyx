import { Controller, Get, Patch, Body, Param, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, ProjectMembershipGuard, ProjectRoleGuard, MinimumRole, CurrentUser, type AuthenticatedUser } from '../../common/index.js';
import { getDb } from '../../database/client.js';
import { items } from '../../database/schema/items.js';
import { itemStatuses } from '../../database/schema/config.js';
import { itemTags, tags as tagsTable } from '../../database/schema/tags.js';
import { eq, and, isNull } from 'drizzle-orm';
import { moveItemSchema } from '@cordlyx/shared';
import { ItemsService } from './items.service.js';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Controller('projects/:projectSlug/board')
@UseGuards(JwtAuthGuard, ProjectMembershipGuard)
export class BoardController {
  constructor(
    private readonly itemsService: ItemsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Get()
  async getBoard(@Req() req: Request) {
    const db = getDb();
    const projectId = req.projectId as string;

    const statuses = await db
      .select()
      .from(itemStatuses)
      .where(eq(itemStatuses.projectId, projectId))
      .orderBy(itemStatuses.sortOrder);

    const boardItems = await db
      .select()
      .from(items)
      .where(
        and(eq(items.projectId, projectId), isNull(items.deletedAt)),
      )
      .orderBy(items.sortOrder);

    // Fetch tags for all board items
    const itemTagRows = await db
      .select({
        itemId: itemTags.itemId,
        id: tagsTable.id,
        name: tagsTable.name,
        color: tagsTable.color,
      })
      .from(itemTags)
      .innerJoin(tagsTable, eq(itemTags.tagId, tagsTable.id));

    // Group tags by itemId
    const tagMap: Record<string, { id: string; name: string; color: string | null }[]> = {};
    for (const row of itemTagRows) {
      const iid = row.itemId;
      if (iid) {
        if (!tagMap[iid]) tagMap[iid] = [];
        tagMap[iid].push({
          id: row.id ?? '',
          name: row.name ?? '',
          color: row.color,
        });
      }
    }

    // Attach tags to items
    const boardItemsWithTags = boardItems.map((item) => ({
      ...item,
      tags: tagMap[item.id] ?? [],
    }));

    // Group items by status
    const columns = statuses.map((status) => ({
      ...status,
      items: boardItemsWithTags.filter((item) => item.statusId === status.id),
    }));

    return columns;
  }

  @Patch(':itemId')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async moveItem(
    @Req() req: Request,
    @Param('itemId') itemId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const db = getDb();
    const data = moveItemSchema.parse(body);

    // Capture old status before move
    const [oldRow] = await db
      .select({ statusId: items.statusId })
      .from(items)
      .where(and(eq(items.id, itemId), eq(items.projectId, req.projectId as string)))
      .limit(1);
    const oldStatusId = oldRow?.statusId ?? null;

    // Resolve status names
    const [oldStatus] = oldStatusId
      ? await db.select({ name: itemStatuses.name }).from(itemStatuses).where(eq(itemStatuses.id, oldStatusId)).limit(1)
      : [];
    const [newStatus] = await db.select({ name: itemStatuses.name }).from(itemStatuses).where(eq(itemStatuses.id, data.statusId)).limit(1);

    const item = await this.itemsService.moveItem(req.projectId as string, itemId, data);
    this.eventEmitter.emit('item.status_changed', {
      projectId: req.projectId,
      item,
      oldValue: oldStatus?.name ?? null,
      newValue: newStatus?.name ?? null,
      actorId: user.id,
    });
    return item;
  }
}
