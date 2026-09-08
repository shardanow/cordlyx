import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { getDb } from '../../../database/client.js';
import { users } from '../../../database/schema/users.js';
import { eq } from 'drizzle-orm';

interface JwtPayload {
  sub: string;
  email: string;
  isAdmin?: boolean;
  type?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  async validate(payload: JwtPayload) {
    // Refresh tokens must never authenticate API requests
    // (missing type = issued before token typing, still accepted).
    if (payload.type === 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }
    const db = getDb();
    const result = await db
      .select({ id: users.id, email: users.email, isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!result[0]) {
      throw new UnauthorizedException('User not found');
    }

    return result[0];
  }
}
