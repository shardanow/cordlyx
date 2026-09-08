import { Injectable, Logger, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { createHmac } from 'node:crypto';
import { WebhooksService, WEBHOOK_EVENTS, type WebhookTarget } from './webhooks.service.js';

export const WEBHOOK_MAX_ATTEMPTS = 3;
export const WEBHOOK_BACKOFF_MS = [0, 2000, 8000];
export const WEBHOOK_TIMEOUT_MS = 10000;

/**
 * Delivers project webhooks for domain events.
 *
 * Fire-and-forget: dispatch never throws into the request path.
 * Each attempt is POSTed with a JSON body signed via HMAC-SHA256
 * (X-Cordlyx-Signature: sha256=<hex>) and recorded in webhook_deliveries.
 */
export function signWebhookPayload(body: string, secret: string | null): string | null {
  if (!secret) return null;
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class WebhookDispatcherService {
  private readonly logger = new Logger(WebhookDispatcherService.name);

  constructor(
    private readonly webhooksService: WebhooksService,
    @Optional() private readonly opts: { backoffMs?: number[] } = {},
  ) {}

  private backoff(attempt: number): number {
    return this.opts.backoffMs?.[attempt - 1] ?? WEBHOOK_BACKOFF_MS[attempt - 1] ?? 8000;
  }

  private forward(event: string, payload: Record<string, unknown>): void {
    const projectId = typeof payload?.projectId === 'string' ? payload.projectId : null;
    if (!projectId) return;
    void this.dispatch(event, projectId, payload).catch((err) => {
      this.logger.warn(`Webhook dispatch failed (${event}): ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  private async dispatch(event: string, projectId: string, payload: Record<string, unknown>): Promise<void> {
    let targets: WebhookTarget[];
    try {
      targets = await this.webhooksService.findActiveForProject(projectId);
    } catch (err) {
      this.logger.warn(`Webhook lookup failed (${event}): ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    const matched = targets.filter((t) => !t.events?.length || t.events.includes(event));
    if (matched.length === 0) return;
    await Promise.allSettled(matched.map((t) => this.deliver(t, event, projectId, payload)));
  }

  private async deliver(
    target: WebhookTarget,
    event: string,
    projectId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const body = JSON.stringify({ event, projectId, sentAt: new Date().toISOString(), data: payload });
    const signature = signWebhookPayload(body, target.secret);

    for (let attempt = 1; attempt <= WEBHOOK_MAX_ATTEMPTS; attempt++) {
      if (attempt > 1) await sleep(this.backoff(attempt));
      const started = Date.now();
      try {
        const res = await fetch(target.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Cordlyx-Event': event,
            'X-Cordlyx-Delivery': `${target.id}:${Date.now()}`,
            ...(signature ? { 'X-Cordlyx-Signature': signature } : {}),
          },
          body,
          signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
        });
        // Drain the body so sockets are reused.
        await res.arrayBuffer().catch(() => null);
        const durationMs = Date.now() - started;
        if (res.ok) {
          await this.webhooksService.recordDelivery({
            webhookId: target.id,
            event,
            httpStatus: res.status,
            success: true,
            durationMs,
            attempt,
          });
          return;
        }
        await this.webhooksService.recordDelivery({
          webhookId: target.id,
          event,
          httpStatus: res.status,
          success: false,
          errorMessage: `HTTP ${res.status}`,
          durationMs,
          attempt,
        });
      } catch (err) {
        const durationMs = Date.now() - started;
        const message = err instanceof Error ? err.message : String(err);
        await this.webhooksService
          .recordDelivery({
            webhookId: target.id,
            event,
            success: false,
            errorMessage: message.length > 500 ? message.slice(0, 500) : message,
            durationMs,
            attempt,
          })
          .catch(() => {});
      }
    }
  }

  @OnEvent('item.created')
  onItemCreated(payload: Record<string, unknown>) { this.forward('item.created', payload); }
  @OnEvent('item.updated')
  onItemUpdated(payload: Record<string, unknown>) { this.forward('item.updated', payload); }
  @OnEvent('item.deleted')
  onItemDeleted(payload: Record<string, unknown>) { this.forward('item.deleted', payload); }
  @OnEvent('item.status_changed')
  onItemStatusChanged(payload: Record<string, unknown>) { this.forward('item.status_changed', payload); }
  @OnEvent('item.assigned')
  onItemAssigned(payload: Record<string, unknown>) { this.forward('item.assigned', payload); }
  @OnEvent('comment.created')
  onCommentCreated(payload: Record<string, unknown>) { this.forward('comment.created', payload); }
  @OnEvent('comment.updated')
  onCommentUpdated(payload: Record<string, unknown>) { this.forward('comment.updated', payload); }
  @OnEvent('comment.deleted')
  onCommentDeleted(payload: Record<string, unknown>) { this.forward('comment.deleted', payload); }
  @OnEvent('comment.reaction_added')
  onReactionAdded(payload: Record<string, unknown>) { this.forward('comment.reaction_added', payload); }
  @OnEvent('comment.reaction_removed')
  onReactionRemoved(payload: Record<string, unknown>) { this.forward('comment.reaction_removed', payload); }
  @OnEvent('attachment.created')
  onAttachmentCreated(payload: Record<string, unknown>) { this.forward('attachment.created', payload); }
  @OnEvent('attachment.deleted')
  onAttachmentDeleted(payload: Record<string, unknown>) { this.forward('attachment.deleted', payload); }
  @OnEvent('relation.created')
  onRelationCreated(payload: Record<string, unknown>) { this.forward('relation.created', payload); }
  @OnEvent('relation.deleted')
  onRelationDeleted(payload: Record<string, unknown>) { this.forward('relation.deleted', payload); }
  @OnEvent('plan.created')
  onPlanCreated(payload: Record<string, unknown>) { this.forward('plan.created', payload); }
  @OnEvent('plan.updated')
  onPlanUpdated(payload: Record<string, unknown>) { this.forward('plan.updated', payload); }
  @OnEvent('plan.deleted')
  onPlanDeleted(payload: Record<string, unknown>) { this.forward('plan.deleted', payload); }
  @OnEvent('plan.status_changed')
  onPlanStatusChanged(payload: Record<string, unknown>) { this.forward('plan.status_changed', payload); }
  @OnEvent('roadmap.created')
  onRoadmapCreated(payload: Record<string, unknown>) { this.forward('roadmap.created', payload); }
  @OnEvent('roadmap.updated')
  onRoadmapUpdated(payload: Record<string, unknown>) { this.forward('roadmap.updated', payload); }
  @OnEvent('roadmap.deleted')
  onRoadmapDeleted(payload: Record<string, unknown>) { this.forward('roadmap.deleted', payload); }
}

export { WEBHOOK_EVENTS };
