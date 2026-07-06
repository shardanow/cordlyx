import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, ProjectMembershipGuard, ProjectRoleGuard, MinimumRole, CurrentUser, type AuthenticatedUser } from '../../common/index.js';
import { CommentsService } from './comments.service.js';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createCommentSchema, updateCommentSchema } from '@cordlyx/shared';

@Controller('projects/:projectSlug/items/:itemId/comments')
@UseGuards(JwtAuthGuard, ProjectMembershipGuard)
export class CommentsController {
  constructor(
    private readonly commentsService: CommentsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Get()
  async list(@Param('itemId') itemId: string) {
    return this.commentsService.getByItem(itemId);
  }

  @Post()
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async create(
    @Req() req: Request,
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const data = createCommentSchema.parse(body);
    const comment = await this.commentsService.create(itemId, user.id, data.body, data.parentId);
    this.eventEmitter.emit('comment.created', { projectId: req.projectId, itemId, comment, actorId: user.id });
    return comment;
  }

  @Patch(':commentId')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async update(
    @Req() req: Request,
    @Param('itemId') itemId: string,
    @Param('commentId') commentId: string,
    @Body() body: unknown,
  ) {
    const data = updateCommentSchema.parse(body);
    const comment = await this.commentsService.update(commentId, data.body);
    this.eventEmitter.emit('comment.updated', { projectId: req.projectId, itemId, commentId, actorId: (req as any).user?.id });
    return comment;
  }

  @Delete(':commentId')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async delete(
    @Req() req: Request,
    @Param('itemId') itemId: string,
    @Param('commentId') commentId: string,
  ) {
    const result = await this.commentsService.softDelete(commentId);
    this.eventEmitter.emit('comment.deleted', { projectId: req.projectId, itemId, commentId, actorId: (req as any).user?.id });
    return result;
  }
}
