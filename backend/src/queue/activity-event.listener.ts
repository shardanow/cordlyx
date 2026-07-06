import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ActivityQueueService } from './activity-queue.service.js';

@Injectable()
export class ActivityEventListener {
  private readonly logger = new Logger(ActivityEventListener.name);

  constructor(private readonly activityQueue: ActivityQueueService) {}

  @OnEvent('item.created')
  async onItemCreated(payload: { projectId: string; item: { id: string; title: string }; actorId: string }) {
    await this.activityQueue.write({
      projectId: payload.projectId,
      actorId: payload.actorId,
      itemId: payload.item.id,
      action: 'item.created',
      newValue: payload.item.title,
    });
  }

  @OnEvent('item.updated')
  async onItemUpdated(payload: {
    projectId: string;
    item: { id: string };
    fieldName: string;
    oldValue: unknown;
    newValue: unknown;
    actorId: string;
  }) {
    await this.activityQueue.write({
      projectId: payload.projectId,
      actorId: payload.actorId,
      itemId: payload.item.id,
      action: 'item.updated',
      fieldName: payload.fieldName,
      oldValue: payload.oldValue,
      newValue: payload.newValue,
    });
  }

  @OnEvent('item.deleted')
  async onItemDeleted(payload: { projectId: string; itemId: string; title?: string; actorId: string }) {
    await this.activityQueue.write({
      projectId: payload.projectId,
      actorId: payload.actorId,
      itemId: payload.itemId,
      action: 'item.deleted',
      newValue: payload.title,
    });
  }

  @OnEvent('item.status_changed')
  async onItemStatusChanged(payload: {
    projectId: string;
    item: { id: string };
    oldValue: string | null;
    newValue: string | null;
    actorId: string;
  }) {
    await this.activityQueue.write({
      projectId: payload.projectId,
      actorId: payload.actorId,
      itemId: payload.item.id,
      action: 'item.status_changed',
      oldValue: payload.oldValue,
      newValue: payload.newValue,
    });
  }

  @OnEvent('item.assigned')
  async onItemAssigned(payload: {
    projectId: string;
    item: { id: string };
    oldValue: string | null;
    newValue: string | null;
    actorId: string;
  }) {
    await this.activityQueue.write({
      projectId: payload.projectId,
      actorId: payload.actorId,
      itemId: payload.item.id,
      action: 'item.assigned',
      oldValue: payload.oldValue,
      newValue: payload.newValue,
    });
  }

  @OnEvent('comment.created')
  async onCommentCreated(payload: {
    projectId: string;
    itemId: string;
    comment: { id: string; body?: string };
    actorId: string;
  }) {
    await this.activityQueue.write({
      projectId: payload.projectId,
      actorId: payload.actorId,
      itemId: payload.itemId,
      action: 'comment.created',
      newValue: payload.comment.body ? payload.comment.body.substring(0, 100) : null,
      metadata: { commentId: payload.comment.id },
    });
  }

  @OnEvent('comment.updated')
  async onCommentUpdated(payload: {
    projectId: string;
    itemId: string;
    commentId: string;
    actorId: string;
  }) {
    await this.activityQueue.write({
      projectId: payload.projectId,
      actorId: payload.actorId,
      itemId: payload.itemId,
      action: 'comment.updated',
      metadata: { commentId: payload.commentId },
    });
  }

  @OnEvent('comment.deleted')
  async onCommentDeleted(payload: {
    projectId: string;
    itemId: string;
    commentId: string;
    actorId: string;
  }) {
    await this.activityQueue.write({
      projectId: payload.projectId,
      actorId: payload.actorId,
      itemId: payload.itemId,
      action: 'comment.deleted',
      metadata: { commentId: payload.commentId },
    });
  }

  @OnEvent('attachment.created')
  async onAttachmentCreated(payload: {
    projectId: string;
    itemId: string;
    actorId: string;
    filename: string | null;
  }) {
    await this.activityQueue.write({
      projectId: payload.projectId,
      actorId: payload.actorId,
      itemId: payload.itemId,
      action: 'attachment.created',
      newValue: payload.filename,
    });
  }

  @OnEvent('attachment.deleted')
  async onAttachmentDeleted(payload: {
    projectId: string;
    itemId: string;
    actorId: string;
  }) {
    await this.activityQueue.write({
      projectId: payload.projectId,
      actorId: payload.actorId,
      itemId: payload.itemId,
      action: 'attachment.deleted',
    });
  }

  @OnEvent('relation.created')
  async onRelationCreated(payload: {
    projectId: string;
    itemId: string;
    actorId: string;
    relationType: string;
    targetItemTitle: string | null;
    targetItemSequenceNum: number | null;
  }) {
    await this.activityQueue.write({
      projectId: payload.projectId,
      actorId: payload.actorId,
      itemId: payload.itemId,
      action: 'relation.created',
      fieldName: payload.relationType,
      newValue: payload.targetItemTitle,
      metadata: { targetItemSequenceNum: payload.targetItemSequenceNum },
    });
  }

  @OnEvent('relation.deleted')
  async onRelationDeleted(payload: {
    projectId: string;
    itemId: string;
    actorId: string;
  }) {
    await this.activityQueue.write({
      projectId: payload.projectId,
      actorId: payload.actorId,
      itemId: payload.itemId,
      action: 'relation.deleted',
    });
  }

  @OnEvent('comment.reaction_added')
  async onReactionAdded(payload: {
    projectId: string;
    itemId: string;
    commentId: string;
    reaction: string;
    actorId: string;
  }) {
    await this.activityQueue.write({
      projectId: payload.projectId,
      actorId: payload.actorId,
      itemId: payload.itemId,
      action: 'comment.reaction_added',
      newValue: payload.reaction,
      metadata: { commentId: payload.commentId },
    });
  }

  @OnEvent('comment.reaction_removed')
  async onReactionRemoved(payload: {
    projectId: string;
    itemId: string;
    commentId: string;
    reaction: string;
    actorId: string;
  }) {
    await this.activityQueue.write({
      projectId: payload.projectId,
      actorId: payload.actorId,
      itemId: payload.itemId,
      action: 'comment.reaction_removed',
      newValue: payload.reaction,
      metadata: { commentId: payload.commentId },
    });
  }
}
