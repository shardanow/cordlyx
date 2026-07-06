import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard, ProjectMembershipGuard, ProjectRoleGuard, MinimumRole, CurrentUser, type AuthenticatedUser } from '../../common/index.js';
import { WebhooksService } from './webhooks.service.js';
import type { Request } from 'express';

@Controller('projects/:projectSlug/webhooks')
@UseGuards(JwtAuthGuard, ProjectMembershipGuard, ProjectRoleGuard)
@MinimumRole('admin')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  async list(@Req() req: Request) {
    return this.webhooksService.list(req.projectId as string);
  }

  @Post()
  async create(@Req() req: Request, @Body() body: { url: string; events: string[] }) {
    return this.webhooksService.create(req.projectId as string, body);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Req() req: Request, @Body() body: { url?: string; events?: string[]; isActive?: boolean }) {
    return this.webhooksService.update(id, req.projectId as string, body);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: Request) {
    await this.webhooksService.delete(id, req.projectId as string);
    return { message: 'Webhook deleted' };
  }
}
