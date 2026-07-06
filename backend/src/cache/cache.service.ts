import { Injectable, Logger } from '@nestjs/common';
import IORedis from 'ioredis';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly client: IORedis;

  constructor() {
    this.client = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379/0', {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    this.client.on('error', (err) => this.logger.warn(`Redis cache error: ${err.message}`));
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds = 3600): Promise<void> {
    try {
      await this.client.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (err: any) {
      this.logger.warn(`Cache set failed for key ${key}: ${err.message}`);
    }
  }

  async del(...keys: string[]): Promise<void> {
    try {
      if (keys.length > 0) await this.client.del(...keys);
    } catch (err: any) {
      this.logger.warn(`Cache del failed: ${err.message}`);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) await this.client.del(...keys);
    } catch (err: any) {
      this.logger.warn(`Cache delPattern failed for ${pattern}: ${err.message}`);
    }
  }
}
