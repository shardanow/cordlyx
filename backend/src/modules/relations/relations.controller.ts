import { Controller, Get, Post, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApiKeyOrJwtAuthGuard, ProjectMembershipGuard, ProjectRoleGuard, MinimumRole, CurrentUser, type AuthenticatedUser } from '../../common/index.js';
import { ApiZodBody, ApiProjectSlugParam, ApiUuidParam, ApiErrorResponses } from '../../common/index.js';
import { assertItemInProject } from '../../common/assert-item.js';
import { RelationsService } from './relations.service.js';
import { createRelationSchema } from '@cordlyx/shared';
import { getDb } from '../../database/client.js';
import { items } from '../../database/schema/items.js';
import { eq } from 'drizzle-orm';

@ApiTags('Relations')
@Controller('projects/:projectSlug/items/:itemId/relations')
@UseGuards(ApiKeyOrJwtAuthGuard, ProjectMembershipGuard)
export class RelationsController {
  constructor(
    private readonly relationsService: RelationsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List relations of an item' })
  @ApiProjectSlugParam()
  @ApiUuidParam('itemId', 'Item id.')
  @ApiResponse({ status: 200, description: 'Relation list.' })
  @ApiErrorResponses(401, 403, 404, 429)
  async list(@Req() req: Request, @Param('itemId') itemId: string) {
    await assertItemInProject(req.projectId as string, itemId);
    return this.relationsService.getByItem(itemId);
  }

  @Post()
  @ApiOperation({ summary: 'Relate an item to another item in the same project' })
  @ApiProjectSlugParam()
  @ApiUuidParam('itemId', 'Source item id.')
  @ApiZodBody(createRelationSchema)
  @ApiResponse({ status: 201, description: 'The created relation.' })
  @ApiErrorResponses(400, 401, 403, 404, 409, 429)
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
    await assertItemInProject(req.projectId as string, itemId);
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
  @ApiOperation({ summary: 'Delete a relation' })
  @ApiProjectSlugParam()
  @ApiUuidParam('itemId', 'Item id.')
  @ApiUuidParam('id', 'Relation id.')
  @ApiResponse({ status: 200, description: 'Deletion result.' })
  @ApiErrorResponses(401, 403, 404, 429)
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async delete(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await assertItemInProject(req.projectId as string, itemId);
    const result = await this.relationsService.delete(id, req.projectId as string);
    this.eventEmitter.emit('relation.deleted', {
      projectId: req.projectId,
      itemId,
      actorId: user.id,
    });
    return result;
  }
}
