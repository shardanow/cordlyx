import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ApiKeyOrJwtAuthGuard, ProjectMembershipGuard } from '../../common/index.js';
import { ApiZodQuery, ApiProjectSlugParam, ApiUuidParam, ApiErrorResponses, ApiListResponse } from '../../common/index.js';
import { assertItemInProject } from '../../common/assert-item.js';
import { ActivitiesService } from './activities.service.js';
import { activityFilterSchema } from '@cordlyx/shared';

@ApiTags('Activities')
@Controller('projects/:projectSlug')
@UseGuards(ApiKeyOrJwtAuthGuard, ProjectMembershipGuard)
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get('activity')
  @ApiOperation({ summary: 'Project activity timeline (cursor pagination, filters)' })
  @ApiProjectSlugParam()
  @ApiZodQuery(activityFilterSchema)
  @ApiListResponse('Activity entries, newest first.', {
    id: '00000000-0000-0000-0000-000000000001',
    action: 'item.created',
    itemSequenceNum: 1,
  })
  @ApiErrorResponses(400, 401, 403, 429)
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
  @ApiOperation({ summary: 'Activity timeline of one item' })
  @ApiProjectSlugParam()
  @ApiUuidParam('itemId', 'Item id.')
  @ApiZodQuery(activityFilterSchema)
  @ApiListResponse('Activity entries, newest first.', {
    id: '00000000-0000-0000-0000-000000000001',
    action: 'comment.created',
  })
  @ApiErrorResponses(400, 401, 403, 404, 429)
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
