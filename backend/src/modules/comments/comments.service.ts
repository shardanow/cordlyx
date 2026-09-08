import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { getDb } from '../../database/client.js';
import { comments } from '../../database/schema/comments.js';
import { items } from '../../database/schema/items.js';
import { users } from '../../database/schema/users.js';
import { eq, and, isNull } from 'drizzle-orm';
import { ReactionsService } from './reactions.service.js';

@Injectable()
export class CommentsService {
  constructor(private readonly reactionsService: ReactionsService) {}

  private selectWithAuthor() {
    return {
      id: comments.id,
      itemId: comments.itemId,
      authorId: comments.authorId,
      parentId: comments.parentId,
      body: comments.body,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      deletedAt: comments.deletedAt,
      author: {
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
      },
    };
  }

  private groupReactions(allReactions: Awaited<ReturnType<ReactionsService['getByCommentIds']>>, commentId: string) {
    const r = allReactions[commentId] ?? {};
    return Object.fromEntries(
      Object.entries(r).map(([reaction, data]) => [reaction, { count: data.count, users: data.users }]),
    );
  }

  async getByItem(itemId: string) {
    const db = getDb();
    const result = await db
      .select(this.selectWithAuthor())
      .from(comments)
      .leftJoin(users, eq(comments.authorId, users.id))
      .where(and(eq(comments.itemId, itemId), isNull(comments.deletedAt)))
      .orderBy(comments.createdAt);

    const allIds = result.map((c) => c.id);
    const allReactions = await this.reactionsService.getByCommentIds(allIds);

    const topLevel = result.filter((c) => !c.parentId);
    const replyMap: Record<string, any[]> = {};
    for (const c of result) {
      if (c.parentId) {
        const key = c.parentId;
        if (!replyMap[key]) replyMap[key] = [];
        replyMap[key].push({
          ...c,
          reactions: this.groupReactions(allReactions, c.id),
        });
      }
    }

    return topLevel.map((c) => ({
      ...c,
      reactions: this.groupReactions(allReactions, c.id),
      replies: replyMap[c.id] ?? [],
    })) as any;
  }

  async create(itemId: string, authorId: string, body: string, parentId?: string | null) {
    const db = getDb();
    const id = randomUUID();
    await db.insert(comments).values({ id, itemId, authorId, body, parentId: parentId ?? null });
    const [comment] = await db
      .select(this.selectWithAuthor())
      .from(comments)
      .leftJoin(users, eq(comments.authorId, users.id))
      .where(eq(comments.id, id))
      .limit(1);
    return comment;
  }

  async update(projectId: string, itemId: string, commentId: string, body: string) {
    const db = getDb();
    await this.assertCommentInProject(projectId, itemId, commentId);
    await db
      .update(comments)
      .set({ body, updatedAt: new Date() })
      .where(eq(comments.id, commentId));
    const [comment] = await db
      .select(this.selectWithAuthor())
      .from(comments)
      .leftJoin(users, eq(comments.authorId, users.id))
      .where(eq(comments.id, commentId))
      .limit(1);
    return comment;
  }

  async softDelete(projectId: string, itemId: string, commentId: string) {
    const db = getDb();
    await this.assertCommentInProject(projectId, itemId, commentId);
    await db
      .update(comments)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(comments.id, commentId));
    return { success: true };
  }

  private async assertCommentInProject(projectId: string, itemId: string, commentId: string): Promise<void> {
    const db = getDb();
    const [row] = await db
      .select({ id: comments.id })
      .from(comments)
      .innerJoin(items, eq(comments.itemId, items.id))
      .where(
        and(
          eq(comments.id, commentId),
          eq(comments.itemId, itemId),
          eq(items.projectId, projectId),
          isNull(items.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException('Comment not found');
  }
}
