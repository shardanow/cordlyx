import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationEventListener } from './notification-event.listener.js';
import { NotificationPrefsService } from './notification-prefs.service.js';
import { MailerService } from './mailer.service.js';
import { DigestSchedulerService } from './digest-scheduler.service.js';
import { EventsModule } from '../events/events.module.js';

@Module({
  imports: [EventsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationEventListener, NotificationPrefsService, MailerService, DigestSchedulerService],
  exports: [NotificationsService, NotificationPrefsService, MailerService],
})
export class NotificationsModule {}
