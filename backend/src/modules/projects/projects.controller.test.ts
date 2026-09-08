import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectsController } from './projects.controller.js';

describe('ProjectsController', () => {
  let controller: ProjectsController;
  let mockService: Record<string, ReturnType<typeof vi.fn>>;
  let mockSnapshot: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    mockService = {
      create: vi.fn(),
      listForUser: vi.fn(),
      getBySlug: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
    };
    mockSnapshot = {
      exportSnapshot: vi.fn(),
      importFile: vi.fn(),
      importNewProject: vi.fn(),
    };
    controller = new ProjectsController(mockService as any, {} as any, mockSnapshot as any, {} as any);
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

  describe('exportSnapshot', () => {
    it('should set download headers and stringify the snapshot', async () => {
      mockSnapshot.exportSnapshot.mockResolvedValueOnce({ version: 1 });
      const res: any = { set: vi.fn() };
      const result = await controller.exportSnapshot('demo', { projectId: 'proj-1' } as any, res);
      expect(mockSnapshot.exportSnapshot).toHaveBeenCalledWith('proj-1');
      expect(res.set).toHaveBeenCalledWith(expect.objectContaining({
        'Content-Type': expect.stringContaining('application/json'),
        'Content-Disposition': expect.stringContaining('demo-snapshot.json'),
      }));
      expect(result).toBe(JSON.stringify({ version: 1 }, null, 2));
    });
  });

  describe('importSnapshot', () => {
    it('should throw without a file', async () => {
      await expect(
        controller.importSnapshot({ projectId: 'proj-1' } as any, { id: 'u-1' } as any, undefined, undefined, undefined),
      ).rejects.toThrow(/No file uploaded/);
    });

    it('should delegate to snapshot service', async () => {
      mockSnapshot.importFile.mockResolvedValueOnce({ data: {}, meta: { dryRun: false } });
      const file = { originalname: 's.json', buffer: Buffer.from('{}') } as any;
      const result = await controller.importSnapshot({ projectId: 'proj-1' } as any, { id: 'u-1' } as any, file, 'false', 'true');
      expect(mockSnapshot.importFile).toHaveBeenCalledWith(
        'proj-1', { originalname: 's.json', buffer: file.buffer }, { dedupe: false, dryRun: true, reporterId: 'u-1' },
      );
      expect(result).toEqual({ data: {}, meta: { dryRun: false } });
    });
  });

  describe('sync', () => {
    it('should parse since/limit and delegate to itemsService', async () => {
      const ctrl = new ProjectsController(mockService as any, {} as any, mockSnapshot as any, {
        syncSince: vi.fn(async () => ({ data: [], meta: {} })),
      } as any);
      const result = await ctrl.sync({ projectId: 'proj-1' } as any, { since: new Date(0).toISOString() });
      expect(result).toEqual({ data: [], meta: {} });
    });

    it('should throw on invalid since', async () => {
      await expect(ctrlSyncInvalid()).rejects.toThrow();
      async function ctrlSyncInvalid() {
        return controller.sync({ projectId: 'proj-1' } as any, { since: 'nope' });
      }
    });
  });

  describe('importSnapshotNew', () => {    it('should throw without a file', async () => {
      await expect(
        controller.importSnapshotNew({ id: 'u-1' } as any, undefined, undefined, undefined, undefined, undefined),
      ).rejects.toThrow(/No file uploaded/);
    });

    it('should parse JSON and delegate with slug/name', async () => {
      mockSnapshot.importNewProject.mockResolvedValueOnce({ project: { slug: 'x' } });
      const file = { originalname: 's.json', buffer: Buffer.from('{"version":1}') } as any;
      await controller.importSnapshotNew({ id: 'u-1' } as any, file, 'x', 'X', undefined, undefined);
      expect(mockSnapshot.importNewProject).toHaveBeenCalledWith('u-1', { version: 1 }, {
        slug: 'x', name: 'X', dedupe: true, dryRun: false,
      });
    });

    it('should throw on invalid JSON', async () => {
      const file = { originalname: 's.json', buffer: Buffer.from('nope') } as any;
      await expect(
        controller.importSnapshotNew({ id: 'u-1' } as any, file, undefined, undefined, undefined, undefined),
      ).rejects.toThrow(/Invalid snapshot JSON/);
    });
  });
});
