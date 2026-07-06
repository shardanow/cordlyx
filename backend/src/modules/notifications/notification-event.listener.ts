import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from './notifications.service.js';
import { EventsGateway } from '../events/events.gateway.js';
import { getDb } from '../../database/client.js';
import { projects } from '../../database/schema/projects.js';
import { items } from '../../database/schema/items.js';
import { comments } from '../../database/schema/comments.js';
import { eq } from 'drizzle-orm';

@Injectable()
export class NotificationEventListener {
  private readonly logger = new Logger(NotificationEventListener.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  private async getProjectSlug(projectId: string): Promise<string | null> {
    const db = getDb();
    const [project] = await db
      .select({ slug: projects.slug })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    return project?.slug ?? null;
  }

  private async getItemInfo(itemId: string) {
    const db = getDb();
    const [item] = await db
      .select({ sequenceNum: items.sequenceNum, title: items.title })
      .from(items)
      .where(eq(items.id, itemId))
      .limit(1);
    return item ?? null;
  }

  private extractMentions(html: string): string[] {
    const mentionPattern = /data-label="([^"]+)"/g;
    return [...html.matchAll(mentionPattern)].map((m) => m[1]!);
  }

  private async notifyMentions(
    projectId: string,
    mentions: string[],
    actorId: string,
    itemId: string,
    extraData: Record<string, unknown>,
    projectSlug: string | null,
    itemSequenceNum: number | null,
    itemTitle: string | null,
  ) {
    for (const label of mentions) {
      const memberIds = await this.notificationsService.findMembersByMention(projectId, label);
      for (const userId of memberIds) {
        const notification = await this.notificationsService.create({
          userId,
          actorId,
          projectId,
          itemId,
          type: 'mention',
          data: { ...extraData, mention: `@${label}`, projectSlug, itemSequenceNum, itemTitle },
        });
        if (notification) {
          this.eventsGateway.emitToUser(userId, 'notification:created', notification);
        }
      }
    }
  }

  @OnEvent('comment.created')
  async onCommentCreated(payload: {
    projectId: string;
    itemId: string;
    comment: { id: string; body: string };
    actorId: string;
  }) {
    const mentions = this.extractMentions(payload.comment.body);
    const [projectSlug, itemInfo] = await Promise.all([
      this.getProjectSlug(payload.projectId),
      this.getItemInfo(payload.itemId),
    ]);
    await this.notifyMentions(payload.projectId, mentions, payload.actorId, payload.itemId, {
      commentId: payload.comment.id,
    }, projectSlug, itemInfo?.sequenceNum ?? null, itemInfo?.title ?? null);
  }

  @OnEvent('item.updated')
  async onItemUpdated(payload: {
    projectId: string;
    item: { id: string };
    actorId: string;
    fieldName: string;
    oldValue: string | null;
    newValue: string | null;
  }) {
    if (payload.fieldName !== 'description') return;
    if (!payload.newValue) return;
    const mentions = this.extractMentions(payload.newValue);
    const [projectSlug, itemInfo] = await Promise.all([
      this.getProjectSlug(payload.projectId),
      this.getItemInfo(payload.item.id),
    ]);
    await this.notifyMentions(payload.projectId, mentions, payload.actorId, payload.item.id, {}, projectSlug, itemInfo?.sequenceNum ?? null, itemInfo?.title ?? null);
  }

  @OnEvent('item.assigned')
  async onItemAssigned(payload: {
    projectId: string;
    item: { id: string; assigneeId?: string | null };
    oldAssigneeId: string | null;
    actorId: string;
  }) {
    const newAssigneeId = payload.item.assigneeId;

    if (newAssigneeId && newAssigneeId !== payload.oldAssigneeId) {
      const [projectSlug, itemInfo] = await Promise.all([
        this.getProjectSlug(payload.projectId),
        this.getItemInfo(payload.item.id),
      ]);
      const notification = await this.notificationsService.create({
        userId: newAssigneeId,
        actorId: payload.actorId,
        projectId: payload.projectId,
        itemId: payload.item.id,
        type: 'assigned',
        data: { projectSlug, itemSequenceNum: itemInfo?.sequenceNum ?? null, itemTitle: itemInfo?.title ?? null },
      });
      if (notification) {
        this.eventsGateway.emitToUser(newAssigneeId, 'notification:created', notification);
      }
    }
  }

  @OnEvent('comment.reaction_added')
  async onReactionAdded(payload: {
    projectId: string;
    commentId: string;
    reaction: string;
    actorId: string;
  }) {
    // Get comment author
    const db = getDb();
    const [comment] = await db
      .select({ authorId: comments.authorId, itemId: comments.itemId })
      .from(comments)
      .where(eq(comments.id, payload.commentId))
      .limit(1);
    if (!comment || comment.authorId === payload.actorId) return; // skip self-reaction

    const [projectSlug, itemInfo] = await Promise.all([
      this.getProjectSlug(payload.projectId),
      this.getItemInfo(comment.itemId),
    ]);

    const notification = await this.notificationsService.create({
      userId: comment.authorId,
      actorId: payload.actorId,
      projectId: payload.projectId,
      itemId: comment.itemId,
      type: 'reaction',
      data: {
        reaction: payload.reaction,
        commentId: payload.commentId,
        projectSlug,
        itemSequenceNum: itemInfo?.sequenceNum ?? null,
        itemTitle: itemInfo?.title ?? null,
      },
    });
    if (notification) {
      this.eventsGateway.emitToUser(comment.authorId, 'notification:created', notification);
    }
  }
}
