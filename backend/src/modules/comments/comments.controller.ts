import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ApiKeyOrJwtAuthGuard, ProjectMembershipGuard, ProjectRoleGuard, MinimumRole, CurrentUser, type AuthenticatedUser } from '../../common/index.js';
import { ApiZodBody, ApiProjectSlugParam, ApiUuidParam, ApiErrorResponses } from '../../common/index.js';
import { assertItemInProject } from '../../common/assert-item.js';
import { CommentsService } from './comments.service.js';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createCommentSchema, updateCommentSchema } from '@cordlyx/shared';

@ApiTags('comments')
@Controller('projects/:projectSlug/items/:itemId/comments')
@UseGuards(ApiKeyOrJwtAuthGuard, ProjectMembershipGuard)
export class CommentsController {
  constructor(
    private readonly commentsService: CommentsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List comments on an item (with replies and reactions)' })
  @ApiProjectSlugParam()
  @ApiUuidParam('itemId', 'Item id.')
  @ApiResponse({ status: 200, description: 'Comment list.' })
  @ApiErrorResponses(401, 403, 404, 429)
  async list(@Req() req: Request, @Param('itemId') itemId: string) {
    await assertItemInProject(req.projectId as string, itemId);
    return this.commentsService.getByItem(itemId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a comment (or a reply via parentId, @mentions notify)' })
  @ApiProjectSlugParam()
  @ApiUuidParam('itemId', 'Item id to comment on.')
  @ApiZodBody(createCommentSchema)
  @ApiResponse({ status: 201, description: 'The created comment.' })
  @ApiErrorResponses(400, 401, 403, 404, 429)
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async create(
    @Req() req: Request,
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const data = createCommentSchema.parse(body);
    await assertItemInProject(req.projectId as string, itemId);
    const comment = await this.commentsService.create(itemId, user.id, data.body, data.parentId);
    this.eventEmitter.emit('comment.created', { projectId: req.projectId, itemId, comment, actorId: user.id });
    return comment;
  }

  @Patch(':commentId')
  @ApiOperation({ summary: 'Edit your comment' })
  @ApiProjectSlugParam()
  @ApiUuidParam('itemId', 'Item id.')
  @ApiUuidParam('commentId', 'Comment id.')
  @ApiZodBody(updateCommentSchema)
  @ApiResponse({ status: 200, description: 'The updated comment.' })
  @ApiErrorResponses(400, 401, 403, 404, 429)
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async update(
    @Req() req: Request,
    @Param('itemId') itemId: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const data = updateCommentSchema.parse(body);
    await assertItemInProject(req.projectId as string, itemId);
    const comment = await this.commentsService.update(req.projectId as string, itemId, commentId, data.body);
    this.eventEmitter.emit('comment.updated', { projectId: req.projectId, itemId, commentId, actorId: user.id });
    return comment;
  }

  @Delete(':commentId')
  @ApiOperation({ summary: 'Delete your comment' })
  @ApiProjectSlugParam()
  @ApiUuidParam('itemId', 'Item id.')
  @ApiUuidParam('commentId', 'Comment id.')
  @ApiResponse({ status: 200, description: 'Deletion result.' })
  @ApiErrorResponses(401, 403, 404, 429)
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async delete(
    @Req() req: Request,
    @Param('itemId') itemId: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await assertItemInProject(req.projectId as string, itemId);
    const result = await this.commentsService.softDelete(req.projectId as string, itemId, commentId);
    this.eventEmitter.emit('comment.deleted', { projectId: req.projectId, itemId, commentId, actorId: user.id });
    return result;
  }
}
