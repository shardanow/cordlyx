import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ApiKeyOrJwtAuthGuard, CurrentUser, type AuthenticatedUser } from '../../common/index.js';
import { ApiZodBody, ApiErrorResponses } from '../../common/index.js';
import { ItemResponseDto } from '../../common/index.js';
import { ItemsService } from './items.service.js';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { quickCreateSchema } from '@cordlyx/shared';
import { getDb } from '../../database/client.js';
import { projects } from '../../database/schema/projects.js';
import { projectMembers } from '../../database/schema/members.js';
import { eq, and } from 'drizzle-orm';

@ApiTags('QuickCreate')
@Controller('quick-create')
@UseGuards(ApiKeyOrJwtAuthGuard)
export class QuickCreateController {
  constructor(
    private readonly itemsService: ItemsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Quick-create one item (project resolved from body slug, member+ required)',
  })
  @ApiZodBody(quickCreateSchema)
  @ApiResponse({ status: 201, description: 'The created item (with sequenceNum for redirect).', type: ItemResponseDto })
  @ApiErrorResponses(400, 401, 403, 404, 429)
  async quickCreate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const data = quickCreateSchema.parse(body);

    // Resolve project from slug or use current project
    const projectSlug = data.projectSlug ?? req.headers['x-project-slug'] as string | undefined;
    if (!projectSlug) {
      const { BadRequestException } = await import('@nestjs/common');
      throw new BadRequestException('Project slug is required');
    }

    const db = getDb();
    const project = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.slug, projectSlug))
      .limit(1);

    if (!project[0]) {
      const { NotFoundException } = await import('@nestjs/common');
      throw new NotFoundException('Project not found');
    }

    // ProjectMembershipGuard cannot run here (slug comes from the body, not params),
    // so enforce membership + member role explicitly. Scoped API keys are enforced too.
    const { ForbiddenException } = await import('@nestjs/common');
    if (req.apiKeyProjectId && req.apiKeyProjectId !== project[0].id) {
      throw new ForbiddenException('API key is scoped to another project');
    }
    const [membership] = await db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, project[0].id), eq(projectMembers.userId, user.id)))
      .limit(1);
    if (!membership) {
      throw new ForbiddenException('You are not a member of this project');
    }
    if (membership.role !== 'member' && membership.role !== 'admin') {
      throw new ForbiddenException('Requires at least member role');
    }

    const item = await this.itemsService.create(
      project[0].id,
      { title: data.title, typeId: data.typeId, statusId: data.statusId, planId: data.planId, description: data.description },
      user.id,
    );
    this.eventEmitter.emit('item.created', { projectId: project[0].id, item, actorId: user.id });
    return item;
  }
}
