import { Controller, Post, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, ProjectMembershipGuard, ProjectRoleGuard, MinimumRole, CurrentUser, type AuthenticatedUser } from '../../common/index.js';
import { ReactionsService } from './reactions.service.js';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { addReactionSchema } from '@cordlyx/shared';

@Controller('projects/:projectSlug/items/:itemId/comments/:commentId/reactions')
@UseGuards(JwtAuthGuard, ProjectMembershipGuard)
export class ReactionsController {
  constructor(
    private readonly reactionsService: ReactionsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Post()
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async add(
    @Req() req: Request,
    @Param('itemId') itemId: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const data = addReactionSchema.parse(body);
    await this.reactionsService.add(commentId, user.id, data.reaction);
    this.eventEmitter.emit('comment.reaction_added', {
      projectId: req.projectId,
      itemId,
      commentId,
      reaction: data.reaction,
      actorId: user.id,
    });
    return { success: true };
  }

  @Delete(':reaction')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async remove(
    @Req() req: Request,
    @Param('itemId') itemId: string,
    @Param('commentId') commentId: string,
    @Param('reaction') reaction: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.reactionsService.remove(commentId, user.id, reaction);
    this.eventEmitter.emit('comment.reaction_removed', {
      projectId: req.projectId,
      itemId,
      commentId,
      reaction,
      actorId: user.id,
    });
    return { success: true };
  }
}
