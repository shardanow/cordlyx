import { Injectable, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { getDb } from '../../database/client.js';
import { users } from '../../database/schema/users.js';
import { eq, or } from 'drizzle-orm';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async register(username: string, email: string, password: string, name: string) {
    const db = getDb();

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(or(eq(users.email, email), eq(users.username, username)))
      .limit(1);
    if (existing[0]) {
      throw new ConflictException('Username or email already taken');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const id = randomUUID();

    await db.insert(users).values({ id, username, email, passwordHash, name });

    return this.generateTokens(id, email);
  }

  async login(login: string, password: string) {
    const db = getDb();

    // Match by username OR email — handles users with NULL username (created before username feature)
    const result = await db
      .select({ id: users.id, email: users.email, passwordHash: users.passwordHash, isAdmin: users.isAdmin })
      .from(users)
      .where(or(eq(users.email, login), eq(users.username, login)))
      .limit(1);

    if (!result[0] || !(await bcrypt.compare(password, result[0].passwordHash))) {
      throw new UnauthorizedException('Invalid login or password');
    }

    return this.generateTokens(result[0].id, result[0].email, result[0].isAdmin);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      // Fetch fresh isAdmin status from DB on refresh
      const db = getDb();
      const result = await db
        .select({ isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.id, payload.sub))
        .limit(1);
      return this.generateTokens(payload.sub, payload.email, result[0]?.isAdmin ?? false);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const db = getDb();

    const result = await db
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!result[0]) {
      throw new NotFoundException('User not found');
    }

    if (!(await bcrypt.compare(currentPassword, result[0].passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  private generateTokens(userId: string, email: string, isAdmin: boolean = false) {
    const payload = { sub: userId, email, isAdmin };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as any,
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as any,
    });

    return { accessToken, refreshToken };
  }
}
