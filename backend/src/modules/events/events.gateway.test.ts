import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventsGateway } from './events.gateway';

describe('EventsGateway', () => {
  let gateway: EventsGateway;
  let mockClient: { join: ReturnType<typeof vi.fn>; leave: ReturnType<typeof vi.fn> };
  let mockServer: { to: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockClient = { join: vi.fn(), leave: vi.fn() };
    mockServer = { to: vi.fn() };
    mockServer.to.mockReturnValue({ emit: vi.fn() });

    gateway = new EventsGateway();
    gateway.server = mockServer as any;
  });

  describe('handleJoinProject', () => {
    it('should join project room', () => {
      gateway.handleJoinProject(mockClient as any, 'proj-1');
      expect(mockClient.join).toHaveBeenCalledWith('proj-1');
    });
  });

  describe('handleLeaveProject', () => {
    it('should leave project room', () => {
      gateway.handleLeaveProject(mockClient as any, 'proj-1');
      expect(mockClient.leave).toHaveBeenCalledWith('proj-1');
    });
  });

  describe('event emission', () => {
    it('should emit item:created to project room', () => {
      const payload = { projectId: 'proj-1', item: { id: 'i-1' }, actorId: 'u-1' };
      gateway.handleItemCreated(payload);

      expect(mockServer.to).toHaveBeenCalledWith('proj-1');
      const actualServer = mockServer.to.mock.results[0]!.value;
      expect(actualServer.emit).toHaveBeenCalledWith('item:created', payload);
    });

    it('should emit item:updated to project room', () => {
      const payload = { projectId: 'proj-1', item: { id: 'i-1' }, actorId: 'u-1' };
      gateway.handleItemUpdated(payload);

      expect(mockServer.to).toHaveBeenCalledWith('proj-1');
      const actualServer = mockServer.to.mock.results[0]!.value;
      expect(actualServer.emit).toHaveBeenCalledWith('item:updated', payload);
    });

    it('should emit item:deleted to project room', () => {
      const payload = { projectId: 'proj-1', itemId: 'i-1', actorId: 'u-1' };
      gateway.handleItemDeleted(payload);

      expect(mockServer.to).toHaveBeenCalledWith('proj-1');
      const actualServer = mockServer.to.mock.results[0]!.value;
      expect(actualServer.emit).toHaveBeenCalledWith('item:deleted', payload);
    });

    it('should emit comment:created to project room', () => {
      const payload = { projectId: 'proj-1', itemId: 'i-1', comment: { id: 'c-1' }, actorId: 'u-1' };
      gateway.handleCommentCreated(payload);

      expect(mockServer.to).toHaveBeenCalledWith('proj-1');
      const actualServer = mockServer.to.mock.results[0]!.value;
      expect(actualServer.emit).toHaveBeenCalledWith('comment:created', payload);
    });

    it('should emit comment:updated to project room', () => {
      const payload = { projectId: 'proj-1', itemId: 'i-1', commentId: 'c-1' };
      gateway.handleCommentUpdated(payload);

      expect(mockServer.to).toHaveBeenCalledWith('proj-1');
      const actualServer = mockServer.to.mock.results[0]!.value;
      expect(actualServer.emit).toHaveBeenCalledWith('comment:updated', payload);
    });

    it('should emit comment:deleted to project room', () => {
      const payload = { projectId: 'proj-1', itemId: 'i-1', commentId: 'c-1' };
      gateway.handleCommentDeleted(payload);

      expect(mockServer.to).toHaveBeenCalledWith('proj-1');
      const actualServer = mockServer.to.mock.results[0]!.value;
      expect(actualServer.emit).toHaveBeenCalledWith('comment:deleted', payload);
    });
  });
});
