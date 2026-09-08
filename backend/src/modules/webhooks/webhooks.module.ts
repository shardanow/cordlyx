import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller.js';
import { WebhooksService } from './webhooks.service.js';
import { WebhookDispatcherService } from './webhook-dispatcher.service.js';

@Module({
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookDispatcherService],
  exports: [WebhooksService, WebhookDispatcherService],
})
export class WebhooksModule {}
