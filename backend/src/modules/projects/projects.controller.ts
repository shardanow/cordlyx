import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard, CurrentUser, type AuthenticatedUser, ProjectMembershipGuard, ProjectRoleGuard, MinimumRole } from '../../common/index.js';
import { ProjectsService } from './projects.service.js';
import { InvitesService } from './invites.service.js';
import { createProjectSchema, updateProjectSchema } from '@cordlyx/shared';
import type { Request } from 'express';

@Controller()
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly invitesService: InvitesService,
  ) {}

  @Post('projects')
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const data = createProjectSchema.parse(body);
    return this.projectsService.create(data, user.id);
  }

  @Get('projects')
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.listForUser(user.id);
  }

  @Get('projects/:projectSlug')
  async getBySlug(@Param('projectSlug') slug: string) {
    const project = await this.projectsService.getBySlug(slug);
    if (!project) throw new (await import('@nestjs/common')).NotFoundException('Project not found');
    return project;
  }

  @Patch('projects/:projectSlug')
  @UseGuards(ProjectMembershipGuard, ProjectRoleGuard)
  @MinimumRole('admin')
  async update(@Param('projectSlug') slug: string, @Req() req: Request, @Body() body: unknown) {
    const data = updateProjectSchema.parse(body);
    return this.projectsService.update(slug, { ...data, projectId: req.projectId as string });
  }

  @Delete('projects/:projectSlug')
  @UseGuards(ProjectMembershipGuard, ProjectRoleGuard)
  @MinimumRole('admin')
  async remove(@Param('projectSlug') slug: string) {
    return this.projectsService.softDelete(slug);
  }

  // --- Invites ---

  @Post('projects/:projectSlug/invites')
  @UseGuards(ProjectMembershipGuard, ProjectRoleGuard)
  @MinimumRole('admin')
  async createInvite(@Param('projectSlug') slug: string, @Req() req: Request, @CurrentUser() user: AuthenticatedUser) {
    return this.invitesService.create(req.projectId as string, user.id);
  }

  @Get('invites/:token')
  @UseGuards(JwtAuthGuard)
  async getInvite(@Param('token') token: string) {
    return this.invitesService.getInfo(token);
  }

  @Post('invites/:token/accept')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async acceptInvite(@Param('token') token: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invitesService.accept(token, user.id);
  }
}
