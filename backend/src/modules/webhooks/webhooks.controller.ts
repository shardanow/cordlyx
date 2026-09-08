import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiKeyOrJwtAuthGuard, ProjectMembershipGuard, ProjectRoleGuard, MinimumRole, CurrentUser, type AuthenticatedUser } from '../../common/index.js';
import { WebhooksService, WEBHOOK_EVENTS } from './webhooks.service.js';
import { z } from 'zod';
import type { Request } from 'express';

const createWebhookSchema = z.object({
  url: z.string().url().max(2048).refine((u) => u.startsWith('http://') || u.startsWith('https://'), {
    message: 'URL must start with http:// or https://',
  }),
  events: z.array(z.enum(WEBHOOK_EVENTS as unknown as [string, ...string[]])).optional().default([]),
});

const updateWebhookSchema = z.object({
  url: z.string().url().max(2048).refine((u) => u.startsWith('http://') || u.startsWith('https://'), {
    message: 'URL must start with http:// or https://',
  }).optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS as unknown as [string, ...string[]])).optional(),
  isActive: z.boolean().optional(),
});

@ApiTags('webhooks')
@Controller('projects/:projectSlug/webhooks')
@UseGuards(ApiKeyOrJwtAuthGuard, ProjectMembershipGuard, ProjectRoleGuard)
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  @MinimumRole('admin')
  @ApiOperation({ summary: 'List webhooks with last delivery status (secrets never exposed)' })
  async list(@Req() req: Request) {
    return this.webhooksService.list(req.projectId as string);
  }

  @Post()
  @MinimumRole('admin')
  @ApiOperation({ summary: 'Create webhook (returns signing secret once — store it)' })
  @ApiResponse({ status: 201, description: 'Webhook including the one-time secret' })
  async create(@Req() req: Request, @Body() body: unknown) {
    const data = createWebhookSchema.parse(body);
    return this.webhooksService.create(req.projectId as string, data);
  }

  @Post(':id/regenerate-secret')
  @MinimumRole('admin')
  @ApiOperation({ summary: 'Rotate the signing secret (returns the new secret once)' })
  async regenerateSecret(@Param('id') id: string, @Req() req: Request) {
    return this.webhooksService.regenerateSecret(id, req.projectId as string);
  }

  @Get(':id/deliveries')
  @MinimumRole('admin')
  @ApiOperation({ summary: 'Recent delivery attempts for a webhook (30-day retention)' })
  async deliveries(
    @Param('id') id: string,
    @Req() req: Request,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit === undefined ? 50 : Number(limit);
    if (!Number.isInteger(parsed)) throw new BadRequestException('Invalid limit');
    return this.webhooksService.getDeliveries(id, req.projectId as string, parsed);
  }

  @Patch(':id')
  @MinimumRole('admin')
  async update(@Param('id') id: string, @Req() req: Request, @Body() body: unknown) {
    const data = updateWebhookSchema.parse(body);
    return this.webhooksService.update(id, req.projectId as string, data);
  }

  @Delete(':id')
  @MinimumRole('admin')
  async delete(@Param('id') id: string, @Req() req: Request) {
    await this.webhooksService.delete(id, req.projectId as string);
    return { message: 'Webhook deleted' };
  }
}
