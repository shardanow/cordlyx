import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProjectRoleGuard, MINIMUM_ROLE } from './project-role.guard.js';

function createMockContext(projectRole: string | undefined, handlerRole?: string) {
  const handler = () => {};
  if (handlerRole) {
    Reflect.defineMetadata(MINIMUM_ROLE, handlerRole, handler);
  }
  return {
    switchToHttp: () => ({
      getRequest: () => ({ projectRole }),
    }),
    getHandler: () => handler,
  } as any;
}

describe('ProjectRoleGuard', () => {
  it('should allow access when no minimum role is set', () => {
    const guard = new ProjectRoleGuard(new Reflector());
    const ctx = createMockContext('viewer');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow admin when minimum is viewer', () => {
    const guard = new ProjectRoleGuard(new Reflector());
    const ctx = createMockContext('admin', 'viewer');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow member when minimum is member', () => {
    const guard = new ProjectRoleGuard(new Reflector());
    const ctx = createMockContext('member', 'member');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow admin when minimum is member', () => {
    const guard = new ProjectRoleGuard(new Reflector());
    const ctx = createMockContext('admin', 'member');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should deny viewer when minimum is member', () => {
    const guard = new ProjectRoleGuard(new Reflector());
    const ctx = createMockContext('viewer', 'member');
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should deny viewer when minimum is admin', () => {
    const guard = new ProjectRoleGuard(new Reflector());
    const ctx = createMockContext('viewer', 'admin');
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should deny member when minimum is admin', () => {
    const guard = new ProjectRoleGuard(new Reflector());
    const ctx = createMockContext('member', 'admin');
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should deny when no project role is set', () => {
    const guard = new ProjectRoleGuard(new Reflector());
    const ctx = createMockContext(undefined, 'member');
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should deny with correct error message', () => {
    const guard = new ProjectRoleGuard(new Reflector());
    const ctx = createMockContext('viewer', 'member');
    expect(() => guard.canActivate(ctx)).toThrow('Requires at least member role');
  });
});
