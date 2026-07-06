import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, ProjectMembershipGuard } from '../../common/index.js';
import { ActivitiesService } from './activities.service.js';
import { activityFilterSchema } from '@cordlyx/shared';

@Controller('projects/:projectSlug')
@UseGuards(JwtAuthGuard, ProjectMembershipGuard)
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
    @Param('itemId') itemId: string,
    @Query() query: unknown,
  ) {
    const filters = activityFilterSchema.parse(query);
    return this.activitiesService.getByItem(itemId, filters.cursor, filters.limit);
  }
}
