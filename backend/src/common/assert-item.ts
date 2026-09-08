import { NotFoundException } from '@nestjs/common';
import { getDb } from '../database/client.js';
import { items } from '../database/schema/items.js';
import { eq, and, isNull } from 'drizzle-orm';

/**
 * Verify an item belongs to the request project (and is not deleted).
 * Call at the top of every `:itemId` handler — service methods that take
 * only ids cannot enforce project isolation on their own.
 */
export async function assertItemInProject(projectId: string, itemId: string): Promise<{ id: string }> {
  const db = getDb();
  const [row] = await db
    .select({ id: items.id })
    .from(items)
    .where(and(eq(items.id, itemId), eq(items.projectId, projectId), isNull(items.deletedAt)))
    .limit(1);
  if (!row) {
    throw new NotFoundException('Item not found');
  }
  return row;
}
