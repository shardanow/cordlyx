import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { getDb } from '../../database/client.js';
import { users } from '../../database/schema/users.js';
import { eq, sql } from 'drizzle-orm';

// Integration tests — require PostgreSQL running
describe('AuthService', () => {
  let authService: AuthService;
  let jwtService: JwtService;

  beforeAll(async () => {
    jwtService = new JwtService({ secret: 'test-secret-key-for-jwt-testing' });
    authService = new AuthService(jwtService);

    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);
  });

  describe('register', () => {
    it('should register a new user and return tokens', async () => {
      const result = await authService.register('testuser', 'test@test.com', 'password123', 'Test User');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should reject duplicate username or email', async () => {
      await expect(
        authService.register('testuser', 'test@test.com', 'password123', 'Another User'),
      ).rejects.toThrow('Username or email already taken');
    });

    it('should hash passwords', async () => {
      const db = getDb();
      const [user] = await db
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.email, 'test@test.com'))
        .limit(1);

      expect(user!.passwordHash).not.toBe('password123');
      expect(user!.passwordHash).toMatch(/^\$2b\$12\$/); // bcrypt cost 12
    });
  });

  describe('validateUser', () => {
    it('should validate correct credentials (email)', async () => {
      const result = await authService.login('test@test.com', 'password123');
      expect(result).toHaveProperty('accessToken');
    });

    it('should validate correct credentials (username)', async () => {
      const result = await authService.login('testuser', 'password123');
      expect(result).toHaveProperty('accessToken');
    });

    it('should reject wrong password', async () => {
      await expect(authService.login('testuser', 'wrong-password')).rejects.toThrow('Invalid login or password');
    });

    it('should reject non-existent username', async () => {
      await expect(authService.login('nobody', 'password123')).rejects.toThrow('Invalid login or password');
    });
  });

  describe('login', () => {
    it('should return tokens for valid credentials (email)', async () => {
      const result = await authService.login('test@test.com', 'password123');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should return tokens for valid credentials (username)', async () => {
      const result = await authService.login('testuser', 'password123');
      expect(result).toHaveProperty('accessToken');
    });

    it('should reject invalid credentials', async () => {
      await expect(
        authService.login('testuser', 'wrong'),
      ).rejects.toThrow('Invalid login or password');
    });
  });

  describe('refresh', () => {
    it('should issue new tokens from valid refresh', async () => {
      const { refreshToken } = await authService.login('testuser', 'password123');
      const result = await authService.refresh(refreshToken);
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should reject invalid refresh token', async () => {
      await expect(
        authService.refresh('invalid-token'),
      ).rejects.toThrow('Invalid or expired refresh token');
    });
  });
});
