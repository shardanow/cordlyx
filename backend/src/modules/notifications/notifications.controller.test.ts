import { describe, it, expect, vi } from 'vitest';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

describe('NotificationsController (unit)', () => {
  const mockNotification = {
    id: 'notif-1',
    type: 'mention',
    projectId: 'proj-1',
    itemId: 'item-1',
    data: { commentId: 'cmt-1' },
    readAt: null,
    createdAt: new Date(),
    actor: { id: 'user-2', name: 'Alice', avatarUrl: null },
  };
  const user = { id: 'user-1', email: 'u@t.com' };

  function createController(mockService: Partial<NotificationsService>) {
    return new NotificationsController(mockService as NotificationsService);
  }

  it('list should return paginated notifications', async () => {
    const spy = vi.fn(async () => ({ data: [mockNotification], meta: { cursor: null, hasMore: false, limit: 50 } }));
    const controller = createController({ getAll: spy });
    await controller.list(user);
    expect(spy).toHaveBeenCalledWith('user-1', undefined, 50);
  });

  it('listUnread should return unread notifications', async () => {
    const controller = createController({ getUnread: async () => [mockNotification] });
    const result = await controller.listUnread(user);
    expect(result).toEqual([mockNotification]);
  });

  it('unreadCount should return count', async () => {
    const controller = createController({ unreadCount: async () => 3 });
    const result = await controller.unreadCount(user);
    expect(result).toEqual({ count: 3 });
  });

  it('markRead should call service', async () => {
    const spy = vi.fn(async () => ({ success: true }));
    const controller = createController({ markRead: spy });
    await controller.markRead(user, 'notif-1');
    expect(spy).toHaveBeenCalledWith('user-1', 'notif-1');
  });

  it('markAllRead should mark all read', async () => {
    const spy = vi.fn(async () => ({ success: true }));
    const controller = createController({ markAllRead: spy });
    const result = await controller.markAllRead(user);
    expect(spy).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ success: true });
  });
});
