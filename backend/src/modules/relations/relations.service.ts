import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { getDb } from '../../database/client.js';
import { itemRelations } from '../../database/schema/relations.js';
import { items } from '../../database/schema/items.js';
import { eq, and, isNull } from 'drizzle-orm';

@Injectable()
export class RelationsService {
  async getByItem(itemId: string) {
    const db = getDb();

    const outgoingRows = await db
      .select()
      .from(itemRelations)
      .leftJoin(items, eq(itemRelations.targetItemId, items.id))
      .where(eq(itemRelations.sourceItemId, itemId));

    const incomingRows = await db
      .select()
      .from(itemRelations)
      .leftJoin(items, eq(itemRelations.sourceItemId, items.id))
      .where(eq(itemRelations.targetItemId, itemId));

    const outgoing = outgoingRows.map((r) => ({
      ...r.item_relations,
      targetItem: r.items ? { id: r.items.id, sequenceNum: r.items.sequenceNum, title: r.items.title } : null,
      sourceItem: null,
    }));

    const incoming = incomingRows.map((r) => ({
      ...r.item_relations,
      sourceItem: r.items ? { id: r.items.id, sequenceNum: r.items.sequenceNum, title: r.items.title } : null,
      targetItem: null,
    }));

    return { outgoing, incoming };
  }

  async create(sourceItemId: string, targetItemId: string, relationType: string, sourceProjectId: string) {
    const db = getDb();

    const targetItem = await db
      .select({ projectId: items.projectId })
      .from(items)
      .where(and(eq(items.id, targetItemId), isNull(items.deletedAt)))
      .limit(1);

    if (!targetItem[0]) {
      throw new NotFoundException('Target item not found');
    }
    if (targetItem[0].projectId !== sourceProjectId) {
      throw new BadRequestException('Cannot create relations between items from different projects');
    }

    const existing = await db
      .select({ id: itemRelations.id })
      .from(itemRelations)
      .where(
        and(
          eq(itemRelations.sourceItemId, sourceItemId),
          eq(itemRelations.targetItemId, targetItemId),
          eq(itemRelations.relationType, relationType),
        ),
      )
      .limit(1);

    if (existing[0]) {
      throw new ConflictException('Relation already exists');
    }

    const id = randomUUID();
    await db.insert(itemRelations).values({ id, sourceItemId, targetItemId, relationType });
    return db.select().from(itemRelations).where(eq(itemRelations.id, id)).limit(1).then((r) => r[0]);
  }

  async delete(relationId: string) {
    const db = getDb();
    await db.delete(itemRelations).where(eq(itemRelations.id, relationId));
    return { success: true };
  }
}
