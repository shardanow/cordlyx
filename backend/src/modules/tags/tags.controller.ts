import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, ProjectMembershipGuard, ProjectRoleGuard, MinimumRole } from '../../common/index.js';
import { TagsService } from './tags.service.js';
import { createTagSchema } from '@cordlyx/shared';

@Controller('projects/:projectSlug/tags')
@UseGuards(JwtAuthGuard, ProjectMembershipGuard)
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  async list(@Req() req: Request) {
    return this.tagsService.list(req.projectId as string);
  }

  @Post()
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async create(@Req() req: Request, @Body() body: unknown) {
    const data = createTagSchema.parse(body);
    return this.tagsService.create(req.projectId as string, data.name, data.color);
  }

  @Patch(':id')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const data = createTagSchema.partial().parse(body);
    return this.tagsService.update(id, data);
  }

  @Delete(':id')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async delete(@Param('id') id: string) {
    return this.tagsService.delete(id);
  }
}
