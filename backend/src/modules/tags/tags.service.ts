import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { getDb } from '../../database/client.js';
import { tags } from '../../database/schema/tags.js';
import { eq } from 'drizzle-orm';

@Injectable()
export class TagsService {
  async list(projectId: string) {
    const db = getDb();
    return db.select().from(tags).where(eq(tags.projectId, projectId)).orderBy(tags.name);
  }

  async create(projectId: string, name: string, color?: string | null) {
    const db = getDb();
    const id = randomUUID();
    await db.insert(tags).values({ id, projectId, name, color: color ?? null });
    return db.select().from(tags).where(eq(tags.id, id)).limit(1).then((r) => r[0]);
  }

  async update(tagId: string, data: { name?: string; color?: string | null }) {
    const db = getDb();
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.color !== undefined) updateData.color = data.color;
    if (Object.keys(updateData).length > 0) {
      await db.update(tags).set(updateData as any).where(eq(tags.id, tagId));
    }
    return db.select().from(tags).where(eq(tags.id, tagId)).limit(1).then((r) => r[0]);
  }

  async delete(tagId: string) {
    const db = getDb();
    await db.delete(tags).where(eq(tags.id, tagId));
    return { success: true };
  }
}
