import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PlansService } from './plans.service.js';
import { getDb } from '../../database/client.js';
import { users } from '../../database/schema/users.js';
import { projects } from '../../database/schema/projects.js';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';

describe('PlansService', () => {
  let plansService: PlansService;
  let projectId: string;

  beforeAll(async () => {
    plansService = new PlansService({ emit: () => {} } as any);
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);

    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      email: 'plans-test@test.com',
      passwordHash: await bcrypt.hash('password123', 12),
      name: 'Plans Test',
    });

    projectId = randomUUID();
    await db.insert(projects).values({
      id: projectId,
      name: 'Plans Test Project',
      slug: 'plans-test-project',
      description: null,
      ownerId: userId,
      isArchived: false,
      settings: {},
    });
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);
  });

  it('should list plans (empty)', async () => {
    const result = await plansService.list(projectId);
    expect(result).toEqual([]);
  });

  it('should create a plan', async () => {
    const plan = await plansService.create(projectId, { name: 'v1.0', type: 'release', color: '#3B82F6' });
    expect(plan.name).toBe('v1.0');
    expect(plan.type).toBe('release');
    expect(plan.color).toBe('#3B82F6');
    expect(plan.status).toBe('active');
  });

  it('should list plans after creation', async () => {
    const result = await plansService.list(projectId);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.map((p) => p.name)).toContain('v1.0');
  });

  it('should get plan by id', async () => {
    const plans = await plansService.list(projectId);
    const plan = plans[0]!;
    const found = await plansService.getById(projectId, plan.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(plan.id);
  });

  it('should update a plan', async () => {
    const plans = await plansService.list(projectId);
    const plan = plans[0]!;
    const updated = await plansService.update(projectId, plan.id, { name: 'v2.0', status: 'completed' });
    expect(updated.name).toBe('v2.0');
    expect(updated.status).toBe('completed');
  });

  it('should delete a plan', async () => {
    const plans = await plansService.list(projectId);
    const plan = plans.find((p) => p.name === 'v2.0');
    if (plan) {
      const result = await plansService.delete(projectId, plan.id);
      expect(result).toEqual({ success: true });
    }
    const remaining = await plansService.list(projectId);
    expect(remaining.find((p) => p.id === plan?.id)).toBeUndefined();
  });

  it('should create a plan with all fields', async () => {
    const plan = await plansService.create(projectId, {
      name: 'Q4 Goal',
      type: 'goal',
      description: 'Quarterly goal',
      color: '#10B981',
      status: 'active',
      sortOrder: 1,
    });
    expect(plan.name).toBe('Q4 Goal');
    expect(plan.description).toBe('Quarterly goal');
    expect(plan.sortOrder).toBe(1);
  });
});
