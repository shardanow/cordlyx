import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  ApiKeyOrJwtAuthGuard,
  ProjectMembershipGuard,
  ProjectRoleGuard,
  MinimumRole,
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/index.js';
import { ProjectViewsService, createViewSchema, updateViewSchema } from './project-views.service.js';

@ApiTags('projects')
@Controller('projects/:projectSlug/views')
@UseGuards(ApiKeyOrJwtAuthGuard, ProjectMembershipGuard)
export class ProjectViewsController {
  constructor(private readonly viewsService: ProjectViewsService) {}

  @Get()
  @ApiOperation({ summary: 'List my views plus views shared with the project' })
  async list(@Req() req: Request, @CurrentUser() user: AuthenticatedUser) {
    return this.viewsService.list(req.projectId as string, user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Save a filter view (personal, optionally shared)' })
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async create(@Req() req: Request, @CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const data = createViewSchema.parse(body);
    return this.viewsService.create(req.projectId as string, user.id, data);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename / edit filters / share (owner or admin)' })
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async update(
    @Param('id') id: string,
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const data = updateViewSchema.parse(body);
    return this.viewsService.update(id, req.projectId as string, user.id, req.projectRole === 'admin', data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a view (owner or admin)' })
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async remove(@Param('id') id: string, @Req() req: Request, @CurrentUser() user: AuthenticatedUser) {
    return this.viewsService.remove(id, req.projectId as string, user.id, req.projectRole === 'admin');
  }

  @Post(':id/set-default')
  @ApiOperation({ summary: 'Make a view the project default (admin)' })
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async setDefault(@Param('id') id: string, @Req() req: Request) {
    return this.viewsService.setDefault(id, req.projectId as string);
  }
}
