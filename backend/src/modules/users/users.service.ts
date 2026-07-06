import { Injectable, NotFoundException } from '@nestjs/common';
import { getDb } from '../../database/client.js';
import { users } from '../../database/schema/users.js';
import { eq, or, sql } from 'drizzle-orm';

@Injectable()
export class UsersService {
  async getProfile(userId: string) {
    const db = getDb();
    const result = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return result[0] ?? null;
  }

  async updateProfile(userId: string, data: { name?: string; avatarUrl?: string | null }) {
    const db = getDb();
    const result = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return result[0] ?? null;
  }

  async search(q: string) {
    const db = getDb();
    const pattern = `%${q}%`;
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(
        or(
          sql`${users.name} ILIKE ${pattern}`,
          sql`${users.email} ILIKE ${pattern}`,
        ),
      )
      .limit(10);

    return rows;
  }

  async deleteAccount(userId: string) {
    const db = getDb();

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (!existing[0]) {
      throw new NotFoundException('User not found');
    }

    await db.update(users).set({ isActive: false, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    const db = getDb();
    const result = await db
      .update(users)
      .set({ avatarUrl, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });
    return result[0] ?? null;
  }
}
