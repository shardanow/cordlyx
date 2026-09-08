import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { ApiKeyOrJwtAuthGuard, ProjectMembershipGuard } from '../../common/index.js';
import { assertItemInProject } from '../../common/assert-item.js';
import { ActivitiesService } from './activities.service.js';
import { activityFilterSchema } from '@cordlyx/shared';

@Controller('projects/:projectSlug')
@UseGuards(ApiKeyOrJwtAuthGuard, ProjectMembershipGuard)
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get('activity')
  async getProjectActivity(@Req() req: Request, @Query() query: unknown) {
    const filters = activityFilterSchema.parse(query);
    return this.activitiesService.getByProject(
      req.projectId as string,
      filters.cursor,
      filters.limit,
      filters.action,
      filters.dateFrom,
      filters.dateTo,
      filters.sort,
    );
  }

  @Get('items/:itemId/activity')
  async getItemActivity(
    @Req() req: Request,
    @Param('itemId') itemId: string,
    @Query() query: unknown,
  ) {
    const filters = activityFilterSchema.parse(query);
    await assertItemInProject(req.projectId as string, itemId);
    return this.activitiesService.getByItem(itemId, filters.cursor, filters.limit);
  }
}
