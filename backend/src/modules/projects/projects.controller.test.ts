import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectsController } from './projects.controller.js';

describe('ProjectsController', () => {
  let controller: ProjectsController;
  let mockService: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    mockService = {
      create: vi.fn(),
      listForUser: vi.fn(),
      getBySlug: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
    };
    controller = new ProjectsController(mockService as any);
  });

  describe('create', () => {
    it('should create project with parsed data', async () => {
      const project = { id: 'p-1', name: 'Test', slug: 'test' };
      mockService.create.mockResolvedValueOnce(project);
      const user = { id: 'u-1' };

      const result = await controller.create(user as any, { name: 'Test', slug: 'test' });

      expect(mockService.create).toHaveBeenCalledWith({ name: 'Test', slug: 'test' }, 'u-1');
      expect(result).toEqual(project);
    });

    it('should throw on invalid data', async () => {
      await expect(
        controller.create({ id: 'u-1' } as any, { name: '' }),
      ).rejects.toThrow();
    });
  });

  describe('list', () => {
    it('should list projects for user', async () => {
      const projects = [{ id: 'p-1' }];
      mockService.listForUser.mockResolvedValueOnce(projects);
      const result = await controller.list({ id: 'u-1' } as any);
      expect(result).toEqual(projects);
    });
  });

  describe('getBySlug', () => {
    it('should return project when found', async () => {
      const project = { id: 'p-1', slug: 'test' };
      mockService.getBySlug.mockResolvedValueOnce(project);
      const result = await controller.getBySlug('test');
      expect(result).toEqual(project);
    });

    it('should throw NotFoundException when not found', async () => {
      mockService.getBySlug.mockResolvedValueOnce(null);
      await expect(controller.getBySlug('missing')).rejects.toThrow('Project not found');
    });
  });

  describe('update', () => {
    it('should update project with parsed data', async () => {
      const project = { id: 'p-1', name: 'Updated' };
      mockService.update.mockResolvedValueOnce(project);
      const result = await controller.update('test', { projectId: 'proj-1' } as any, { name: 'Updated' });
      expect(mockService.update).toHaveBeenCalledWith('test', { name: 'Updated', projectId: 'proj-1' });
      expect(result).toEqual(project);
    });
  });

  describe('remove', () => {
    it('should soft-delete project', async () => {
      mockService.softDelete.mockResolvedValueOnce({ success: true });
      const result = await controller.remove('test');
      expect(mockService.softDelete).toHaveBeenCalledWith('test');
      expect(result).toEqual({ success: true });
    });
  });
});
