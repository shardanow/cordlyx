import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { ApiKeyOrJwtAuthGuard, ProjectMembershipGuard } from '../../common/index.js';
import { ProjectStatsService } from './project-stats.service.js';

@ApiTags('projects')
@Controller('projects/:projectSlug/stats')
@UseGuards(ApiKeyOrJwtAuthGuard, ProjectMembershipGuard)
export class ProjectStatsController {
  constructor(private readonly statsService: ProjectStatsService) {}

  @Get()
  @ApiOperation({ summary: 'Project overview: totals, funnel by status, overdue, workload by assignee' })
  async getStats(@Req() req: Request) {
    return this.statsService.getStats(req.projectId as string);
  }
}
