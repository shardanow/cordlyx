import { Controller, Get, Post, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtAuthGuard, ProjectMembershipGuard, ProjectRoleGuard, MinimumRole, CurrentUser, type AuthenticatedUser } from '../../common/index.js';
import { RelationsService } from './relations.service.js';
import { createRelationSchema } from '@cordlyx/shared';
import { getDb } from '../../database/client.js';
import { items } from '../../database/schema/items.js';
import { eq } from 'drizzle-orm';

@Controller('projects/:projectSlug/items/:itemId/relations')
@UseGuards(JwtAuthGuard, ProjectMembershipGuard)
export class RelationsController {
  constructor(
    private readonly relationsService: RelationsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Get()
  async list(@Param('itemId') itemId: string) {
    return this.relationsService.getByItem(itemId);
  }

  @Post()
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async create(
    @Param('itemId') itemId: string,
    @Req() req: Request,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const db = getDb();
    const data = createRelationSchema.parse(body);
    const relation = await this.relationsService.create(itemId, data.targetItemId, data.relationType, req.projectId as string);
    const [targetItem] = await db
      .select({ title: items.title, sequenceNum: items.sequenceNum })
      .from(items)
      .where(eq(items.id, data.targetItemId))
      .limit(1);
    this.eventEmitter.emit('relation.created', {
      projectId: req.projectId,
      itemId,
      actorId: user.id,
      relationType: data.relationType,
      targetItemTitle: targetItem?.title ?? null,
      targetItemSequenceNum: targetItem?.sequenceNum ?? null,
    });
    return relation;
  }

  @Delete(':id')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async delete(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.relationsService.delete(id);
    this.eventEmitter.emit('relation.deleted', {
      projectId: req.projectId,
      itemId,
      actorId: user.id,
    });
    return result;
  }
}
