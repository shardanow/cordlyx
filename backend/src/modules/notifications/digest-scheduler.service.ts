import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

/**
 * Schedules the hourly digest fan-out on the activity queue.
 * BullMQ dedups the repeatable job by name+pattern, so multiple API
 * boots (or replicas) do not create duplicate schedules.
 */
@Injectable()
export class DigestSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(DigestSchedulerService.name);

  constructor(@InjectQueue('activity') private readonly activityQueue: Queue) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.activityQueue.add(
        'digest-hourly',
        { hour: null },
        {
          repeat: { pattern: '0 * * * *' },
          removeOnComplete: { age: 3600 },
          removeOnFail: { age: 3600 * 24 },
        },
      );
    } catch (err) {
      this.logger.warn(`Digest schedule failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
