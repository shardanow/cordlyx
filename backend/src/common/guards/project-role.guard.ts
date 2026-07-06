import { Injectable, CanActivate, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const MINIMUM_ROLE = 'minimum_role';
export const MinimumRole = (role: string) => SetMetadata(MINIMUM_ROLE, role);

const roleHierarchy: Record<string, number> = {
  viewer: 1,
  member: 2,
  admin: 3,
};

@Injectable()
export class ProjectRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRole = this.reflector.get<string>(MINIMUM_ROLE, context.getHandler());
    if (!requiredRole) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const currentRole: string | undefined = request.projectRole;

    if (!currentRole) {
      throw new ForbiddenException('No project role found');
    }

    const required = roleHierarchy[requiredRole] ?? 0;
    const actual = roleHierarchy[currentRole] ?? 0;

    if (actual < required) {
      throw new ForbiddenException(`Requires at least ${requiredRole} role`);
    }

    return true;
  }
}
