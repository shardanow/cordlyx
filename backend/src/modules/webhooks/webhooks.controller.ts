import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ApiKeyOrJwtAuthGuard, ProjectMembershipGuard, ProjectRoleGuard, MinimumRole, CurrentUser, type AuthenticatedUser } from '../../common/index.js';
import { ApiZodBody, ApiProjectSlugParam, ApiUuidParam, ApiErrorResponses, ApiListResponse } from '../../common/index.js';
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
  @ApiProjectSlugParam()
  @ApiListResponse('Webhooks.')
  @ApiErrorResponses(401, 403, 429)
  async list(@Req() req: Request) {
    return this.webhooksService.list(req.projectId as string);
  }

  @Post()
  @MinimumRole('admin')
  @ApiOperation({ summary: 'Create webhook (returns signing secret once — store it)' })
  @ApiProjectSlugParam()
  @ApiZodBody(createWebhookSchema)
  @ApiResponse({ status: 201, description: 'Webhook including the one-time secret' })
  @ApiErrorResponses(400, 401, 403, 429)
  async create(@Req() req: Request, @Body() body: unknown) {
    const data = createWebhookSchema.parse(body);
    return this.webhooksService.create(req.projectId as string, data);
  }

  @Post(':id/regenerate-secret')
  @MinimumRole('admin')
  @ApiOperation({ summary: 'Rotate the signing secret (returns the new secret once)' })
  @ApiProjectSlugParam()
  @ApiUuidParam('id', 'Webhook id.')
  @ApiResponse({ status: 201, description: 'Webhook including the new one-time secret.' })
  @ApiErrorResponses(401, 403, 404, 429)
  async regenerateSecret(@Param('id') id: string, @Req() req: Request) {
    return this.webhooksService.regenerateSecret(id, req.projectId as string);
  }

  @Get(':id/deliveries')
  @MinimumRole('admin')
  @ApiOperation({ summary: 'Recent delivery attempts for a webhook (30-day retention)' })
  @ApiProjectSlugParam()
  @ApiUuidParam('id', 'Webhook id.')
  @ApiQuery({ name: 'limit', required: false, description: 'Max deliveries (default 50).', schema: { type: 'integer', default: 50 } })
  @ApiResponse({ status: 200, description: 'Delivery attempts, newest first.' })
  @ApiErrorResponses(400, 401, 403, 404, 429)
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
  @ApiOperation({ summary: 'Update a webhook (URL, events, active flag)' })
  @ApiProjectSlugParam()
  @ApiUuidParam('id', 'Webhook id.')
  @ApiZodBody(updateWebhookSchema)
  @ApiResponse({ status: 200, description: 'The updated webhook (secret never exposed).' })
  @ApiErrorResponses(400, 401, 403, 404, 429)
  async update(@Param('id') id: string, @Req() req: Request, @Body() body: unknown) {
    const data = updateWebhookSchema.parse(body);
    return this.webhooksService.update(id, req.projectId as string, data);
  }

  @Delete(':id')
  @MinimumRole('admin')
  @ApiOperation({ summary: 'Delete a webhook' })
  @ApiProjectSlugParam()
  @ApiUuidParam('id', 'Webhook id.')
  @ApiResponse({ status: 200, description: '{ message: "Webhook deleted" }.' })
  @ApiErrorResponses(401, 403, 404, 429)
  async delete(@Param('id') id: string, @Req() req: Request) {
    await this.webhooksService.delete(id, req.projectId as string);
    return { message: 'Webhook deleted' };
  }
}
