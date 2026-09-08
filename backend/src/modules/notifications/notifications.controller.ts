import { Controller, Get, Patch, Post, Put, Param, Query, Body, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiKeyOrJwtAuthGuard, ProjectMembershipGuard, AdminGuard, CurrentUser, type AuthenticatedUser } from '../../common/index.js';
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
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.getAll(user.id, cursor, parseLimit(limit));
  }

  @Get('unread')
  async listUnread(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getUnread(user.id);
  }

  @Get('unread/count')
  async unreadCount(@CurrentUser() user: AuthenticatedUser) {
    const count = await this.notificationsService.unreadCount(user.id);
    return { count };
  }

  @Patch(':id/read')
  async markRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notificationsService.markRead(user.id, id);
  }

  @Patch('read-all')
  async markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Get('prefs')
  @ApiOperation({ summary: 'My per-project notification preferences' })
  async getPrefs(@CurrentUser() user: AuthenticatedUser) {
    return this.prefsService.getMine(user.id);
  }

  @Put('prefs/:projectSlug')
  @ApiOperation({ summary: 'Mute / digest settings for one project (self)' })
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
  @ApiResponse({ status: 503, description: 'Email not configured (SMTP_HOST)' })
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
