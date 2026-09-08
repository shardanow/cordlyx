import { describe, it, expect } from 'vitest';
import { ProjectMembershipGuard } from './project-membership.guard.js';

function ctxWithCache(params: Record<string, string>, extra: Record<string, unknown>) {
  const request = { params, ...extra };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;
}

describe('ProjectMembershipGuard API-key scope (cache path, DB-free)', () => {
  const cachedProject = { projectId: 'proj-1', role: 'member' };
  const cache = { get: async () => cachedProject, set: async () => {}, del: async () => {} } as any;

  it('rejects a scoped key used in another project', async () => {
    const guard = new ProjectMembershipGuard(cache);
    const ctx = ctxWithCache({ projectSlug: 'other' }, { user: { id: 'u-1' }, apiKeyProjectId: 'proj-2' });
    await expect(guard.canActivate(ctx)).rejects.toThrow('scoped to another project');
  });

  it('allows a scoped key in its own project', async () => {
    const guard = new ProjectMembershipGuard(cache);
    const ctx = ctxWithCache({ projectSlug: 'mine' }, { user: { id: 'u-1' }, apiKeyProjectId: 'proj-1' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(ctx.switchToHttp().getRequest().projectId).toBe('proj-1');
  });

  it('allows unscoped requests as before', async () => {
    const guard = new ProjectMembershipGuard(cache);
    const ctx = ctxWithCache({ projectSlug: 'mine' }, { user: { id: 'u-1' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});
