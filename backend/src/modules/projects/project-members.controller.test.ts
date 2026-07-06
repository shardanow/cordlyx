import { describe, it, expect, vi } from 'vitest';
import { ProjectMembersController } from './project-members.controller.js';
import { ProjectMembersService } from './project-members.service.js';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('ProjectMembersController (unit)', () => {
  const mockMembers = [
    { id: 'mem-1', userId: 'user-1', role: 'admin', email: 'alice@test.com', name: 'Alice' },
    { id: 'mem-2', userId: 'user-2', role: 'member', email: 'bob@test.com', name: 'Bob' },
  ];

  function createController(mockService: Partial<ProjectMembersService>) {
    return new ProjectMembersController(mockService as ProjectMembersService);
  }

  const req = { projectId: 'proj-1' } as any;

  it('list should return all members', async () => {
    const controller = createController({ getMembers: async () => mockMembers as any });
    const result = await controller.list(req);
    expect(result).toEqual(mockMembers);
  });

  it('add should call service with parsed body and return members', async () => {
    const spy = vi.fn(async () => mockMembers as any);
    const controller = createController({ addMember: spy });
    await controller.add(req, { userId: '00000000-0000-0000-0000-000000000001', email: 'charlie@test.com', role: 'member' } as any);
    expect(spy).toHaveBeenCalledWith('proj-1', { userId: '00000000-0000-0000-0000-000000000001', email: 'charlie@test.com' }, 'member');
  });

  it('add should throw ConflictException if user already a member', async () => {
    const controller = createController({
      addMember: async () => { throw new ConflictException('User is already a member of this project'); },
    });
    await expect(
      controller.add(req, { userId: '00000000-0000-0000-0000-000000000001', email: 'alice@test.com', role: 'member' } as any),
    ).rejects.toThrow('User is already a member of this project');
  });

  it('add should throw NotFoundException if email not found', async () => {
    const controller = createController({
      addMember: async () => { throw new NotFoundException('User not found with this email'); },
    });
    await expect(
      controller.add(req, { userId: '00000000-0000-0000-0000-000000000001', email: 'nobody@test.com', role: 'member' } as any),
    ).rejects.toThrow('User not found with this email');
  });

  it('add should throw on validation error (invalid role)', async () => {
    const controller = createController({ addMember: async () => mockMembers as any });
    await expect(
      controller.add(req, { userId: '00000000-0000-0000-0000-000000000001', email: 'x@x.com', role: 'superadmin' } as any),
    ).rejects.toThrow();
  });

  it('update should call service with new role', async () => {
    const spy = vi.fn(async () => mockMembers as any);
    const controller = createController({ updateMember: spy });
    await controller.update(req, 'mem-2', { role: 'admin' } as any);
    expect(spy).toHaveBeenCalledWith('proj-1', 'mem-2', 'admin');
  });

  it('remove should call service and return members', async () => {
    const spy = vi.fn(async () => [mockMembers[0]] as any);
    const controller = createController({ removeMember: spy });
    await controller.remove(req, 'mem-2');
    expect(spy).toHaveBeenCalledWith('proj-1', 'mem-2');
  });
});
