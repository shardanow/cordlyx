import { Controller, Get, Patch, Post, Put, Param, Query, Body, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ApiKeyOrJwtAuthGuard, ProjectMembershipGuard, AdminGuard, CurrentUser, type AuthenticatedUser } from '../../common/index.js';
import { ApiZodBody, ApiProjectSlugParam, ApiUuidParam, ApiErrorResponses, ApiListResponse } from '../../common/index.js';
import type { Request } from 'express';
import { NotificationsService } from './notifications.service.js';
import { NotificationPrefsService, updatePrefsSchema } from './notification-prefs.service.js';
import { MailerService } from './mailer.service.js';
import { runHourlyDigest, toDigestItems } from './digest-runner.js';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(ApiKeyOrJwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly prefsService: NotificationPrefsService,
    private readonly mailerService: MailerService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List my notifications, newest first (cursor pagination)' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor.' })
  @ApiQuery({ name: 'limit', required: false, description: 'Page size 1–100 (default 50).', schema: { type: 'integer', default: 50 } })
  @ApiListResponse(
    'Notifications.',
    { id: '00000000-0000-0000-0000-000000000001', type: 'mention', readAt: null },
  )
  @ApiErrorResponses(400, 401, 429)
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.getAll(user.id, cursor, parseLimit(limit));
  }

  @Get('unread')
  @ApiOperation({ summary: 'List my unread notifications' })
  @ApiListResponse('Unread notifications.')
  @ApiErrorResponses(401, 429)
  async listUnread(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getUnread(user.id);
  }

  @Get('unread/count')
  @ApiOperation({ summary: 'Count my unread notifications (badge)' })
  @ApiResponse({ status: 200, description: '{ count }.' })
  @ApiErrorResponses(401, 429)
  async unreadCount(@CurrentUser() user: AuthenticatedUser) {
    const count = await this.notificationsService.unreadCount(user.id);
    return { count };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  @ApiUuidParam('id', 'Notification id.')
  @ApiResponse({ status: 200, description: 'The updated notification.' })
  @ApiErrorResponses(401, 404, 429)
  async markRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notificationsService.markRead(user.id, id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  @ApiResponse({ status: 200, description: '{ updated: <count> }.' })
  @ApiErrorResponses(401, 429)
  async markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Get('prefs')
  @ApiOperation({ summary: 'My per-project notification preferences' })
  @ApiResponse({ status: 200, description: 'Preference list.' })
  @ApiErrorResponses(401, 429)
  async getPrefs(@CurrentUser() user: AuthenticatedUser) {
    return this.prefsService.getMine(user.id);
  }

  @Put('prefs/:projectSlug')
  @ApiOperation({ summary: 'Mute / digest settings for one project (self)' })
  @ApiProjectSlugParam()
  @ApiZodBody(updatePrefsSchema)
  @ApiResponse({ status: 200, description: 'The saved preferences.' })
  @ApiErrorResponses(400, 401, 403, 429)
  @UseGuards(ProjectMembershipGuard)
  async upsertPrefs(
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const data = updatePrefsSchema.parse(body);
    return this.prefsService.upsert(user.id, req.projectId as string, data);
  }

  @Post('digest/send')
  @ApiOperation({ summary: 'Send myself an email digest of unread notifications now' })
  @ApiResponse({ status: 200, description: '{ sent, reason? }.' })
  @ApiResponse({ status: 503, description: 'Email not configured (SMTP_HOST)' })
  @ApiErrorResponses(401, 429)
  async sendDigestNow(@CurrentUser() user: AuthenticatedUser) {
    if (!this.mailerService.isConfigured()) {
      const { ServiceUnavailableException } = await import('@nestjs/common');
      throw new ServiceUnavailableException('Email is not configured (SMTP_HOST)');
    }
    const unread = await this.notificationsService.getUnread(user.id, 20);
    const items = toDigestItems(unread);
    if (items.length === 0) return { sent: false, reason: 'no unread notifications' };
    const db = (await import('../../database/client.js')).getDb();
    const { users } = await import('../../database/schema/users.js');
    const { eq } = await import('drizzle-orm');
    const [me] = await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, user.id)).limit(1);
    if (!me) return { sent: false, reason: 'user not found' };
    const sent = await this.mailerService.sendDigest(me.email, me.name, items);
    return { sent };
  }

  @Post('digest/run-hour')
  @ApiOperation({ summary: 'Run the hourly digest fan-out (server admin; same work the scheduler does)' })
  @ApiQuery({ name: 'hour', required: false, description: 'UTC hour 0–23 (default: current hour).', schema: { type: 'integer' } })
  @ApiResponse({ status: 201, description: 'Fan-out result.' })
  @ApiErrorResponses(400, 401, 403, 429)
  @UseGuards(AdminGuard)
  async runDigestHour(@Query('hour') hour?: string) {
    const h = hour === undefined ? new Date().getUTCHours() : Number(hour);
    if (!Number.isInteger(h) || h < 0 || h > 23) {
      const { BadRequestException } = await import('@nestjs/common');
      throw new BadRequestException('hour must be 0-23');
    }
    return runHourlyDigest({}, h);
  }
}

function parseLimit(value: string | undefined, fallback = 50): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 100) {
    throw new BadRequestException('Invalid limit');
  }
  return n;
}
