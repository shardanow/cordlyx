import { Controller, Get } from '@nestjs/common';
import { getDb } from './database/client.js';
import { sql } from 'drizzle-orm';

@Controller('health')
export class HealthController {
  @Get()
  async check() {
    const db = getDb();
    await db.execute(sql`SELECT 1`);
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
