import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from 'nestjs-pino';
import { configModule } from './config/index.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { ItemsModule } from './modules/items/items.module.js';
import { CommentsModule } from './modules/comments/comments.module.js';
import { TagsModule } from './modules/tags/tags.module.js';
import { AttachmentsModule } from './modules/attachments/attachments.module.js';
import { RelationsModule } from './modules/relations/relations.module.js';
import { ActivitiesModule } from './modules/activities/activities.module.js';
import { SearchModule } from './modules/search/search.module.js';
import { EventsModule } from './modules/events/events.module.js';
import { ApiKeysModule } from './modules/api-keys/api-keys.module.js';
import { PlansModule } from './modules/plans/plans.module.js';
import { RoadmapsModule } from './modules/roadmaps/roadmaps.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { WebhooksModule } from './modules/webhooks/webhooks.module.js';
import { QueueModule } from './queue/queue.module.js';
import { StorageModule } from './storage/storage.module.js';
import { CacheModule } from './cache/cache.module.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [
    configModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        // No transport = JSON stdout, no worker thread = no crash on hot-reload
        // For pretty output in dev: npm run dev 2>&1 | npx pino-pretty
      },
    }),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60000, limit: 60 },
    ]),
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.' }),
    QueueModule,
    StorageModule,
    CacheModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    ItemsModule,
    CommentsModule,
    TagsModule,
    AttachmentsModule,
    RelationsModule,
    ActivitiesModule,
    SearchModule,
    EventsModule,
    ApiKeysModule,
    PlansModule,
    RoadmapsModule,
    NotificationsModule,
    AdminModule,
    WebhooksModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
