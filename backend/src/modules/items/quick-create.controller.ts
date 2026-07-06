import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, CurrentUser, type AuthenticatedUser } from '../../common/index.js';
import { ItemsService } from './items.service.js';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { quickCreateSchema } from '@cordlyx/shared';
import { getDb } from '../../database/client.js';
import { projects } from '../../database/schema/projects.js';
import { eq } from 'drizzle-orm';

@Controller('quick-create')
@UseGuards(JwtAuthGuard)
export class QuickCreateController {
  constructor(
    private readonly itemsService: ItemsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Post()
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

    const item = await this.itemsService.create(
      project[0].id,
      { title: data.title, typeId: data.typeId, statusId: data.statusId, planId: data.planId, description: data.description },
      user.id,
    );
    this.eventEmitter.emit('item.created', { projectId: project[0].id, item, actorId: user.id });
    return item;
  }
}
