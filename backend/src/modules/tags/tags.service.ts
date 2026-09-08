import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { getDb } from '../../database/client.js';
import { tags } from '../../database/schema/tags.js';
import { eq, and } from 'drizzle-orm';

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

  async update(projectId: string, tagId: string, data: { name?: string; color?: string | null }) {
    const db = getDb();
    await this.assertTagInProject(projectId, tagId);
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.color !== undefined) updateData.color = data.color;
    if (Object.keys(updateData).length > 0) {
      await db.update(tags).set(updateData as any).where(eq(tags.id, tagId));
    }
    return db.select().from(tags).where(eq(tags.id, tagId)).limit(1).then((r) => r[0]);
  }

  async delete(projectId: string, tagId: string) {
    const db = getDb();
    await this.assertTagInProject(projectId, tagId);
    await db.delete(tags).where(eq(tags.id, tagId));
    return { success: true };
  }

  private async assertTagInProject(projectId: string, tagId: string): Promise<void> {
    const db = getDb();
    const [row] = await db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.id, tagId), eq(tags.projectId, projectId)))
      .limit(1);
    if (!row) throw new NotFoundException('Tag not found in this project');
  }
}
