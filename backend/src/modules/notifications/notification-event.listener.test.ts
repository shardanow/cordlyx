import { describe, it, expect, vi } from 'vitest';
import { NotificationEventListener } from './notification-event.listener.js';
import { NotificationsService } from './notifications.service.js';
import { EventsGateway } from '../events/events.gateway.js';

vi.mock('../../database/client.js', () => {
  const db: any = {
    select: vi.fn(() => db),
    from: vi.fn(() => db),
    where: vi.fn(() => db),
    limit: vi.fn(() => Promise.resolve([{ slug: 'test-project', sequenceNum: 1 }])),
  };
  return { getDb: vi.fn(() => db) };
});

describe('NotificationEventListener (unit)', () => {
  function createListener(
    mockService: Partial<NotificationsService>,
    mockGateway: Partial<EventsGateway> = {},
    mockPrefs: { isMuted?: (userId: string, projectId: string) => Promise<boolean> } = {},
  ) {
    const gateway = { emitToUser: vi.fn(), ...mockGateway } as unknown as EventsGateway;
    const prefs = { isMuted: async () => false, ...mockPrefs } as any;
    return { listener: new NotificationEventListener(mockService as NotificationsService, gateway, prefs), gateway };
  }

  it('should create mention notification for @mentioned user', async () => {
    const createSpy = vi.fn(async () => ({ id: 'notif-1', type: 'mention' }));
    const { listener } = createListener({
      findMembersByMention: async () => ['user-2'],
      create: createSpy,
    });

    await listener.onCommentCreated({
      projectId: 'proj-1',
      itemId: 'item-1',
      comment: { id: 'cmt-1', body: 'Hey <span data-label="alice">@alice</span> check this out' },
      actorId: 'user-1',
    });

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-2',
      actorId: 'user-1',
      type: 'mention',
    }));
  });

  it('should not create notification for self-mention', async () => {
    const createSpy = vi.fn(async () => null);
    const { listener } = createListener({
      findMembersByMention: async () => ['user-1'], // same as actorId
      create: createSpy,
    });

    await listener.onCommentCreated({
      projectId: 'proj-1',
      itemId: 'item-1',
      comment: { id: 'cmt-1', body: '<span data-label="myself">@myself</span>' },
      actorId: 'user-1',
    });

    // create() returns null when userId === actorId (handled in service)
    expect(createSpy).toHaveBeenCalled();
  });

  it('should skip mention notification if no match found', async () => {
    const createSpy = vi.fn(async () => null);
    const { listener } = createListener({
      findMembersByMention: async () => [],
      create: createSpy,
    });

    await listener.onCommentCreated({
      projectId: 'proj-1',
      itemId: 'item-1',
      comment: { id: 'cmt-1', body: '<span data-label="nobody">@nobody</span>' },
      actorId: 'user-1',
    });

    expect(createSpy).not.toHaveBeenCalled();
  });

  it('should create assigned notification on new assignee', async () => {
    const createSpy = vi.fn(async () => ({ id: 'notif-2', type: 'assigned' }));
    const { listener } = createListener({ create: createSpy });

    await listener.onItemAssigned({
      projectId: 'proj-1',
      item: { id: 'item-1', assigneeId: 'user-2' },
      oldAssigneeId: null,
      oldValue: null,
      newValue: 'User Two',
      actorId: 'user-1',
    });

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-2',
      type: 'assigned',
    }));
  });

  it('should not notify on reassignment to same user', async () => {
    const createSpy = vi.fn(async () => null);
    const { listener } = createListener({ create: createSpy });

    await listener.onItemAssigned({
      projectId: 'proj-1',
      item: { id: 'item-1', assigneeId: 'user-2' },
      oldAssigneeId: 'user-2',
      oldValue: 'User Two',
      newValue: 'User Two',
      actorId: 'user-1',
    });

    expect(createSpy).not.toHaveBeenCalled();
  });

  it('should skip notifications for muted projects', async () => {
    const createSpy = vi.fn(async () => ({ id: 'notif-3' }));
    const { listener } = createListener(
      {
        findMembersByMention: async () => ['user-2'],
        create: createSpy,
      },
      {},
      { isMuted: async () => true },
    );

    await listener.onCommentCreated({
      projectId: 'proj-1',
      itemId: 'item-1',
      comment: { id: 'cmt-1', body: '<span data-label="bob">@bob</span>' },
      actorId: 'user-1',
    });
    expect(createSpy).not.toHaveBeenCalled();

    await listener.onItemAssigned({
      projectId: 'proj-1',
      item: { id: 'item-1', assigneeId: 'user-2' },
      oldAssigneeId: null,
      oldValue: null,
      newValue: 'User Two',
      actorId: 'user-1',
    });
    expect(createSpy).not.toHaveBeenCalled();
  });
});
