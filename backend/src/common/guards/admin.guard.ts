import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as { id: string; email: string; isAdmin?: boolean } | undefined;

    if (!user) {
      throw new ForbiddenException('Not authenticated');
    }

    // First check: ADMIN_EMAILS env var (takes priority)
    const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (adminEmails.length > 0 && adminEmails.includes(user.email.toLowerCase())) {
      return true;
    }

    // Second check: isAdmin flag from DB (in JWT)
    if (user.isAdmin) {
      return true;
    }

    throw new ForbiddenException('Admin access required');
  }
}
