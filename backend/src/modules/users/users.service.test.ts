import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { UsersService } from './users.service.js';
import { getDb } from '../../database/client.js';
import { users } from '../../database/schema/users.js';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';

describe('UsersService', () => {
  let usersService: UsersService;
  let userId: string;

  beforeAll(async () => {
    usersService = new UsersService();
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);

    userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      email: 'users-test@test.com',
      passwordHash: await bcrypt.hash('password123', 12),
      name: 'Users Test',
    });
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);
  });

  it('should get profile for existing user', async () => {
    const profile = await usersService.getProfile(userId);
    expect(profile).not.toBeNull();
    expect(profile!.id).toBe(userId);
    expect(profile!.email).toBe('users-test@test.com');
    expect(profile!.name).toBe('Users Test');
  });

  it('should return null for non-existent user', async () => {
    const profile = await usersService.getProfile(randomUUID());
    expect(profile).toBeNull();
  });

  it('should update user name', async () => {
    const updated = await usersService.updateProfile(userId, { name: 'Updated Name' });
    expect(updated!.name).toBe('Updated Name');
  });

  it('should update avatar URL', async () => {
    const updated = await usersService.updateProfile(userId, { avatarUrl: 'https://example.com/avatar.png' });
    expect(updated!.avatarUrl).toBe('https://example.com/avatar.png');
  });

  it('should clear avatar URL', async () => {
    const updated = await usersService.updateProfile(userId, { avatarUrl: null });
    expect(updated!.avatarUrl).toBeNull();
  });

  it('should return null when updating non-existent user', async () => {
    const result = await usersService.updateProfile(randomUUID(), { name: 'Ghost' });
    expect(result).toBeNull();
  });
});
