import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { getDb } from '../../database/client.js';
import { commentReactions } from '../../database/schema/comment-reactions.js';
import { users } from '../../database/schema/users.js';
import { eq, and, inArray } from 'drizzle-orm';

@Injectable()
export class ReactionsService {
  async add(commentId: string, userId: string, reaction: string) {
    const db = getDb();
    const id = randomUUID();
    try {
      await db.insert(commentReactions).values({ id, commentId, userId, reaction });
    } catch {
      // Unique constraint violation — already reacted, ignore
    }
    return { success: true };
  }

  async remove(commentId: string, userId: string, reaction: string) {
    const db = getDb();
    await db
      .delete(commentReactions)
      .where(
        and(
          eq(commentReactions.commentId, commentId),
          eq(commentReactions.userId, userId),
          eq(commentReactions.reaction, reaction),
        ),
      );
    return { success: true };
  }

  async getByCommentIds(commentIds: string[]) {
    if (commentIds.length === 0) return {};
    const db = getDb();
    const rows = await db
      .select({
        commentId: commentReactions.commentId,
        reaction: commentReactions.reaction,
        userId: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
      })
      .from(commentReactions)
      .innerJoin(users, eq(commentReactions.userId, users.id))
      .where(inArray(commentReactions.commentId, commentIds));

    const grouped: Record<string, Record<string, { count: number; users: { id: string; name: string; avatarUrl: string | null }[] }>> = {};
    for (const row of rows) {
      const cid = row.commentId!;
      const r = row.reaction!;
      if (!grouped[cid]) grouped[cid] = {};
      if (!grouped[cid][r]) {
        grouped[cid][r] = { count: 0, users: [] };
      }
      grouped[cid][r].count++;
      grouped[cid][r].users.push({ id: row.userId!, name: row.name!, avatarUrl: row.avatarUrl });
    }
    return grouped;
  }
}
