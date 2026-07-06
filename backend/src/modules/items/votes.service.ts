import { Injectable, NotFoundException } from '@nestjs/common';
import { getDb } from '../../database/client.js';
import { itemVotes } from '../../database/schema/votes.js';
import { items } from '../../database/schema/items.js';
import { eq, and, sql } from 'drizzle-orm';

@Injectable()
export class VotesService {
  async toggle(projectId: string, itemId: string, userId: string) {
    const db = getDb();

    const item = await db
      .select({ id: items.id })
      .from(items)
      .where(and(eq(items.id, itemId), eq(items.projectId, projectId)))
      .limit(1);
    if (!item[0]) throw new NotFoundException('Item not found');

    const existing = await db
      .select({ id: itemVotes.id })
      .from(itemVotes)
      .where(and(eq(itemVotes.itemId, itemId), eq(itemVotes.userId, userId)))
      .limit(1);

    if (existing[0]) {
      await db.delete(itemVotes).where(eq(itemVotes.id, existing[0].id));
      return { voted: false, voteId: null };
    }

    const [vote] = await db.insert(itemVotes).values({ itemId, userId }).returning({ id: itemVotes.id });
    return { voted: true, voteId: vote!.id };
  }

  async getVotes(itemId: string) {
    const db = getDb();
    const rows = await db
      .select({ userId: itemVotes.userId })
      .from(itemVotes)
      .where(eq(itemVotes.itemId, itemId));
    return { count: rows.length, voters: rows.map((r) => r.userId) };
  }

  async hasVoted(itemId: string, userId: string) {
    const db = getDb();
    const row = await db
      .select({ id: itemVotes.id })
      .from(itemVotes)
      .where(and(eq(itemVotes.itemId, itemId), eq(itemVotes.userId, userId)))
      .limit(1);
    return !!row[0];
  }
}
