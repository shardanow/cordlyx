import { describe, it, expect, vi } from 'vitest';
import { ActivityEventListener } from './activity-event.listener.js';
import { ActivityQueueService } from './activity-queue.service.js';

describe('ActivityEventListener (unit)', () => {
  function createListener(mockQueue: Partial<ActivityQueueService>) {
    return new ActivityEventListener(mockQueue as ActivityQueueService);
  }

  it('onItemCreated should enqueue item.created action with title', async () => {
    const write = vi.fn(async () => {});
    const listener = createListener({ write });
    await listener.onItemCreated({ projectId: 'proj-1', item: { id: 'item-1', title: 'My Item' }, actorId: 'user-1' });
    expect(write).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'proj-1',
      actorId: 'user-1',
      itemId: 'item-1',
      action: 'item.created',
      newValue: 'My Item',
    }));
  });

  it('onItemUpdated should enqueue item.updated action with field details', async () => {
    const write = vi.fn(async () => {});
    const listener = createListener({ write });
    await listener.onItemUpdated({
      projectId: 'proj-1', item: { id: 'item-1' }, fieldName: 'title', oldValue: 'Old', newValue: 'New', actorId: 'user-1',
    });
    expect(write).toHaveBeenCalledWith(expect.objectContaining({
      action: 'item.updated',
      fieldName: 'title',
      oldValue: 'Old',
      newValue: 'New',
    }));
  });

  it('onItemDeleted should enqueue item.deleted action with title', async () => {
    const write = vi.fn(async () => {});
    const listener = createListener({ write });
    await listener.onItemDeleted({ projectId: 'proj-1', itemId: 'item-1', title: 'My Item', actorId: 'user-1' });
    expect(write).toHaveBeenCalledWith(expect.objectContaining({
      action: 'item.deleted',
      itemId: 'item-1',
      newValue: 'My Item',
    }));
  });

  it('onCommentCreated should enqueue comment.created with commentId in metadata', async () => {
    const write = vi.fn(async () => {});
    const listener = createListener({ write });
    await listener.onCommentCreated({
      projectId: 'proj-1',
      itemId: 'item-1',
      comment: { id: 'cmt-1' },
      actorId: 'user-1',
    });
    expect(write).toHaveBeenCalledWith(expect.objectContaining({
      action: 'comment.created',
      itemId: 'item-1',
      metadata: { commentId: 'cmt-1' },
    }));
  });

  it('onCommentUpdated should enqueue comment.updated with actorId', async () => {
    const write = vi.fn(async () => {});
    const listener = createListener({ write });
    await listener.onCommentUpdated({
      projectId: 'proj-1',
      itemId: 'item-1',
      commentId: 'cmt-1',
      actorId: 'user-1',
    });
    expect(write).toHaveBeenCalledWith(expect.objectContaining({
      action: 'comment.updated',
      actorId: 'user-1',
    }));
  });

  it('onCommentDeleted should enqueue comment.deleted', async () => {
    const write = vi.fn(async () => {});
    const listener = createListener({ write });
    await listener.onCommentDeleted({
      projectId: 'proj-1',
      itemId: 'item-1',
      commentId: 'cmt-1',
      actorId: 'user-1',
    });
    expect(write).toHaveBeenCalledWith(expect.objectContaining({
      action: 'comment.deleted',
      metadata: { commentId: 'cmt-1' },
    }));
  });

  it('onItemStatusChanged should enqueue item.status_changed with names', async () => {
    const write = vi.fn(async () => {});
    const listener = createListener({ write });
    await listener.onItemStatusChanged({
      projectId: 'proj-1', item: { id: 'item-1' }, oldValue: 'Backlog', newValue: 'In Progress', actorId: 'user-1',
    });
    expect(write).toHaveBeenCalledWith(expect.objectContaining({
      action: 'item.status_changed',
      oldValue: 'Backlog',
      newValue: 'In Progress',
    }));
  });

  it('onItemAssigned should enqueue item.assigned with names', async () => {
    const write = vi.fn(async () => {});
    const listener = createListener({ write });
    await listener.onItemAssigned({
      projectId: 'proj-1', item: { id: 'item-1' }, oldValue: null, newValue: 'John Doe', actorId: 'user-1',
    });
    expect(write).toHaveBeenCalledWith(expect.objectContaining({
      action: 'item.assigned',
      oldValue: null,
      newValue: 'John Doe',
    }));
  });
});
