import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, ProjectMembershipGuard, ProjectRoleGuard, MinimumRole } from '../../common/index.js';
import { ProjectConfigService } from './project-config.service.js';
import { createItemTypeSchema, createItemStatusSchema, createItemPrioritySchema } from '@cordlyx/shared';

@Controller('projects/:projectSlug')
@UseGuards(JwtAuthGuard, ProjectMembershipGuard)
export class ProjectConfigController {
  constructor(private readonly configService: ProjectConfigService) {}

  // --- Types ---

  @Get('types')
  async getTypes(@Req() req: Request) {
    return this.configService.getTypes(req.projectId as string);
  }

  @Post('types')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async createType(@Req() req: Request, @Body() body: unknown) {
    const data = createItemTypeSchema.parse(body);
    return this.configService.createType(req.projectId as string, data);
  }

  @Patch('types/:id')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async updateType(@Param('id') id: string, @Body() body: unknown) {
    const data = createItemTypeSchema.partial().parse(body);
    return this.configService.updateType(id, data);
  }

  @Delete('types/:id')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async deleteType(@Param('id') id: string) {
    await this.configService.deleteType(id);
    return { success: true };
  }

  // --- Statuses ---

  @Get('statuses')
  async getStatuses(@Req() req: Request) {
    return this.configService.getStatuses(req.projectId as string);
  }

  @Post('statuses')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async createStatus(@Req() req: Request, @Body() body: unknown) {
    const data = createItemStatusSchema.parse(body);
    return this.configService.createStatus(req.projectId as string, data);
  }

  @Patch('statuses/:id')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async updateStatus(@Param('id') id: string, @Body() body: unknown) {
    const data = createItemStatusSchema.partial().parse(body);
    return this.configService.updateStatus(id, data);
  }

  @Delete('statuses/:id')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async deleteStatus(@Param('id') id: string) {
    await this.configService.deleteStatus(id);
    return { success: true };
  }

  // --- Priorities ---

  @Get('priorities')
  async getPriorities(@Req() req: Request) {
    return this.configService.getPriorities(req.projectId as string);
  }

  @Post('priorities')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async createPriority(@Req() req: Request, @Body() body: unknown) {
    const data = createItemPrioritySchema.parse(body);
    return this.configService.createPriority(req.projectId as string, data);
  }

  @Patch('priorities/:id')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async updatePriority(@Param('id') id: string, @Body() body: unknown) {
    const data = createItemPrioritySchema.partial().parse(body);
    return this.configService.updatePriority(id, data);
  }

  @Delete('priorities/:id')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async deletePriority(@Param('id') id: string) {
    await this.configService.deletePriority(id);
    return { success: true };
  }
}
