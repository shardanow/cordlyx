import { describe, it, expect, vi } from 'vitest';
import { AttachmentsController } from './attachments.controller.js';
import { AttachmentsService } from './attachments.service.js';
import { NotFoundException } from '@nestjs/common';

describe('AttachmentsController (unit)', () => {
  const mockAttachment = {
    id: 'att-1',
    itemId: 'item-1',
    filename: 'test.txt',
    originalFilename: 'test.txt',
    mimeType: 'text/plain',
    sizeBytes: 100,
  };

  const req = { projectId: '00000000-0000-0000-0000-000000000002' } as any;
  const user = { id: 'user-1', email: 'u@t.com' };

  function createController(mockService: Partial<AttachmentsService>, emitter?: { emit: ReturnType<typeof vi.fn> }) {
    return new AttachmentsController(mockService as AttachmentsService, (emitter ?? { emit: vi.fn() }) as any);
  }

  it('list should return attachments for item', async () => {
    const controller = createController({ getByItem: async () => [mockAttachment] as any });
    const result = await controller.list('item-1');
    expect(result).toEqual([mockAttachment]);
  });

  it('upload should call service and return attachment', async () => {
    const spy = vi.fn(async () => mockAttachment as any);
    const controller = createController({ upload: spy }, { emit: vi.fn() });
    const file = { buffer: Buffer.from('x'), originalname: 'f.txt', mimetype: 'text/plain', size: 1 };
    const result = await controller.upload('item-1', req, user, file as any);
    expect(spy).toHaveBeenCalledWith('item-1', 'user-1', file);
    expect(result).toEqual(mockAttachment);
  });

  it('delete should call service with both ids', async () => {
    const spy = vi.fn(async () => ({ success: true }));
    const controller = createController({ delete: spy }, { emit: vi.fn() });
    const result = await controller.delete('item-1', 'att-1', req, user);
    expect(spy).toHaveBeenCalledWith('att-1', 'item-1');
    expect(result).toEqual({ success: true });
  });

  it('delete should propagate NotFoundException from service', async () => {
    const controller = createController({
      delete: async () => { throw new NotFoundException('Attachment not found'); },
    }, { emit: vi.fn() });
    await expect(controller.delete('item-1', 'unknown-id', req, user)).rejects.toThrow('Attachment not found');
  });

  it('upload should propagate validation error for disallowed MIME', async () => {
    const controller = createController({
      upload: async () => { throw new Error('File type application/x-msdownload is not allowed'); },
    }, { emit: vi.fn() });
    const file = { buffer: Buffer.from('x'), originalname: 'evil.exe', mimetype: 'application/x-msdownload', size: 1 };
    await expect(controller.upload('item-1', req, user, file as any))
      .rejects.toThrow(/not allowed/);
  });
});
