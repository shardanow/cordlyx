import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ActivityQueueService } from './activity-queue.service.js';
import { ActivityEventListener } from './activity-event.listener.js';

@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL ?? 'redis://localhost:6379/0',
        options: {
          maxRetriesPerRequest: null,
        },
      },
    }),
    BullModule.registerQueue({
      name: 'activity',
    }),
  ],
  providers: [ActivityQueueService, ActivityEventListener],
  exports: [ActivityQueueService, BullModule],
})
export class QueueModule {}
