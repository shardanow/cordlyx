import { Controller, Post, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiParam } from '@nestjs/swagger';
import { Request } from 'express';
import { ApiKeyOrJwtAuthGuard, ProjectMembershipGuard, ProjectRoleGuard, MinimumRole, CurrentUser, type AuthenticatedUser } from '../../common/index.js';
import { ApiZodBody, ApiProjectSlugParam, ApiUuidParam, ApiErrorResponses } from '../../common/index.js';
import { ReactionsService } from './reactions.service.js';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { addReactionSchema } from '@cordlyx/shared';

@ApiTags('Reactions')
@Controller('projects/:projectSlug/items/:itemId/comments/:commentId/reactions')
@UseGuards(ApiKeyOrJwtAuthGuard, ProjectMembershipGuard)
export class ReactionsController {
  constructor(
    private readonly reactionsService: ReactionsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Add an emoji reaction to a comment' })
  @ApiProjectSlugParam()
  @ApiUuidParam('itemId', 'Item id.')
  @ApiUuidParam('commentId', 'Comment id.')
  @ApiZodBody(addReactionSchema)
  @ApiResponse({ status: 201, description: '{ success: true }.' })
  @ApiErrorResponses(400, 401, 403, 404, 429)
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
  @ApiOperation({ summary: 'Remove your emoji reaction from a comment' })
  @ApiProjectSlugParam()
  @ApiUuidParam('itemId', 'Item id.')
  @ApiUuidParam('commentId', 'Comment id.')
  @ApiParam({ name: 'reaction', description: 'Emoji reaction, URL-encoded.', example: '%F0%9F%91%8D' })
  @ApiResponse({ status: 200, description: '{ success: true }.' })
  @ApiErrorResponses(401, 403, 404, 429)
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
