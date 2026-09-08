import { Injectable, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { getDb } from '../../database/client.js';
import { users } from '../../database/schema/users.js';
import { revokedRefreshTokens } from '../../database/schema/revoked-refresh-tokens.js';
import { eq, or, lt } from 'drizzle-orm';

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
      if (payload.type !== 'refresh' || !payload.jti) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }
      const db = getDb();
      const [revoked] = await db
        .select({ jti: revokedRefreshTokens.jti })
        .from(revokedRefreshTokens)
        .where(eq(revokedRefreshTokens.jti, payload.jti))
        .limit(1);
      if (revoked) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }
      // Fetch fresh isAdmin/isActive status from DB on refresh
      const result = await db
        .select({ isAdmin: users.isAdmin, isActive: users.isActive })
        .from(users)
        .where(eq(users.id, payload.sub))
        .limit(1);
      if (!result[0]?.isActive) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }
      return this.generateTokens(payload.sub, payload.email, result[0]?.isAdmin ?? false);
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(userId: string, refreshToken?: string | null) {
    const db = getDb();
    // Opportunistically purge expired denylist rows.
    await db.delete(revokedRefreshTokens).where(lt(revokedRefreshTokens.expiresAt, new Date())).catch(() => {});
    if (!refreshToken) return { success: true };
    try {
      const payload = this.jwtService.verify(refreshToken, { ignoreExpiration: true });
      if (payload.type !== 'refresh' || !payload.jti || payload.sub !== userId) return { success: true };
      const expiresAt = payload.exp ? new Date(payload.exp * 1000) : new Date(Date.now() + 7 * 24 * 3600 * 1000);
      await db
        .insert(revokedRefreshTokens)
        .values({ jti: payload.jti, userId, expiresAt })
        .onConflictDoNothing();
    } catch {
      // Unverifiable token: nothing to revoke.
    }
    return { success: true };
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
    const base = { sub: userId, email, isAdmin };

    const accessToken = this.jwtService.sign(
      { ...base, type: 'access' },
      {
        expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as any,
      },
    );

    const refreshToken = this.jwtService.sign(
      { ...base, type: 'refresh', jti: randomUUID() },
      {
        expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as any,
      },
    );

    return { accessToken, refreshToken };
  }
}
