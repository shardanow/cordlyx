import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export interface ActivityJobData {
  projectId: string;
  actorId: string;
  itemId?: string | null;
  action: string;
  fieldName?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ActivityQueueService {
  constructor(@InjectQueue('activity') private readonly activityQueue: Queue) {}

  async write(data: ActivityJobData): Promise<void> {
    await this.activityQueue.add('write-activity', data, {
      removeOnComplete: { age: 3600 * 24 },
      removeOnFail: { age: 3600 * 24 * 7 },
    });
  }
}
