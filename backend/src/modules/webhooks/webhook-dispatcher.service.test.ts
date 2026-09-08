import { describe, it, expect, vi, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { WebhookDispatcherService, signWebhookPayload } from './webhook-dispatcher.service.js';

describe('signWebhookPayload', () => {
  it('produces a verifiable HMAC-SHA256 signature', () => {
    const body = '{"event":"item.created"}';
    const sig = signWebhookPayload(body, 's3cret');
    expect(sig).toBe(`sha256=${createHmac('sha256', 's3cret').update(body).digest('hex')}`);
  });

  it('returns null without a secret', () => {
    expect(signWebhookPayload('{}', null)).toBeNull();
  });
});

describe('WebhookDispatcherService', () => {
  const hook = (overrides: Record<string, unknown> = {}) => ({
    id: 'wh-1',
    projectId: 'proj-1',
    url: 'https://example.com/hook',
    events: [] as string[],
    secret: 's3cret',
    ...overrides,
  });

  function createDispatcher(hooks: unknown[], fetchImpl: (...args: any[]) => Promise<any>) {
    const recordDelivery = vi.fn(async () => {});
    const service = {
      findActiveForProject: vi.fn(async () => hooks),
      recordDelivery,
    };
    vi.stubGlobal('fetch', fetchImpl);
    const dispatcher = new WebhookDispatcherService(service as any, { backoffMs: [0, 0, 0] });
    return { dispatcher, service, recordDelivery };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs matching events with signature headers', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    const { dispatcher, recordDelivery } = createDispatcher([hook()], fetchMock);
    await (dispatcher as any).dispatch('item.created', 'proj-1', { projectId: 'proj-1' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.com/hook');
    expect(init.method).toBe('POST');
    expect(init.headers['X-Cordlyx-Event']).toBe('item.created');
    expect(init.headers['X-Cordlyx-Signature']).toMatch(/^sha256=[0-9a-f]{64}$/);
    const body = JSON.parse(init.body);
    expect(body.event).toBe('item.created');
    expect(body.projectId).toBe('proj-1');
    expect(recordDelivery).toHaveBeenCalledWith(expect.objectContaining({ success: true, attempt: 1 }));
  });

  it('skips webhooks not subscribed to the event, empty events means all', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    const { dispatcher } = createDispatcher(
      [hook({ id: 'a', events: ['comment.created'] }), hook({ id: 'b', events: [] })],
      fetchMock,
    );
    await (dispatcher as any).dispatch('item.created', 'proj-1', { projectId: 'proj-1' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries failures and records every attempt', async () => {
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls++;
      if (calls < 3) throw new Error('socket hang up');
      return new Response('{}', { status: 200 });
    });
    const { dispatcher, recordDelivery } = createDispatcher([hook()], fetchMock);
    await (dispatcher as any).deliver(hook(), 'item.created', 'proj-1', { projectId: 'proj-1' });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(recordDelivery).toHaveBeenCalledTimes(3);
    expect(recordDelivery.mock.calls[0][0]).toMatchObject({ success: false, attempt: 1 });
    expect(recordDelivery.mock.calls[2][0]).toMatchObject({ success: true, attempt: 3 });
  });

  it('gives up after max attempts without throwing', async () => {
    const fetchMock = vi.fn(async () => new Response('nope', { status: 500 }));
    const { dispatcher, recordDelivery } = createDispatcher([hook()], fetchMock);
    await expect(
      (dispatcher as any).deliver(hook(), 'item.created', 'proj-1', { projectId: 'proj-1' }),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(recordDelivery).toHaveBeenCalledTimes(3);
  });

  it('forward ignores payloads without projectId and never throws', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    const { dispatcher } = createDispatcher([hook()], fetchMock);
    (dispatcher as any).forward('item.created', {});
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
