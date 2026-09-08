import { describe, it, expect, vi } from 'vitest';
import { runHourlyDigest } from './digest-runner.js';
import { MailerService } from './mailer.service.js';

describe('MailerService (unit)', () => {
  it('reports unconfigured without SMTP_HOST', () => {
    const saved = process.env.SMTP_HOST;
    delete process.env.SMTP_HOST;
    try {
      expect(new MailerService().isConfigured()).toBe(false);
    } finally {
      if (saved !== undefined) process.env.SMTP_HOST = saved;
    }
  });

  it('builds subject/text/html bodies', () => {
    const mailer = new MailerService();
    const items = [
      { type: 'mention', actorName: 'Alice', itemTitle: 'Fix <bug>', itemSequenceNum: 3, projectSlug: 'demo', createdAt: new Date().toISOString() },
      { type: 'assigned', actorName: null, itemTitle: null, itemSequenceNum: null, projectSlug: null, createdAt: new Date().toISOString() },
    ];
    expect(mailer.buildDigestSubject(items)).toBe('2 unread notifications');
    expect(mailer.buildDigestText('Bob', items)).toContain('Fix <bug>');
    expect(mailer.buildDigestHtml('Bob', items)).toContain('Fix &lt;bug&gt;');
  });

  it('sendDigest returns false without transport or items', async () => {
    const mailer = new MailerService();
    expect(await mailer.sendDigest('a@b.c', 'A', [])).toBe(false);
  });
});

describe('runHourlyDigest', () => {
  const sub = { userId: 'u1', email: 'u1@x.com', name: 'U1', projectId: 'p1', projectSlug: 'demo', projectName: 'Demo' };
  const unread = [
    { type: 'mention', actor: { name: 'Alice' }, data: { itemTitle: 'T', itemSequenceNum: 1, projectSlug: 'demo' }, createdAt: new Date() },
  ];

  it('returns unconfigured when SMTP is missing', async () => {
    const mailer = { isConfigured: () => false, sendDigest: vi.fn() };
    const res = await runHourlyDigest(
      { prefs: { digestSubscribers: async () => [sub] } as any, notifications: {} as any, mailer: mailer as any },
      8,
    );
    expect(res).toMatchObject({ configured: false, sent: 0 });
    expect(mailer.sendDigest).not.toHaveBeenCalled();
  });

  it('sends to subscribers with unread and skips empty ones', async () => {
    const mailer = { isConfigured: () => true, sendDigest: vi.fn(async () => true) };
    const notifications = { getUnread: vi.fn(async (uid: string) => (uid === 'u1' ? unread : [])) };
    const prefs = {
      digestSubscribers: async () => [
        sub,
        { ...sub, userId: 'u2', email: 'u2@x.com', name: 'U2' },
      ],
    };
    const res = await runHourlyDigest(
      { prefs: prefs as any, notifications: notifications as any, mailer: mailer as any },
      8,
    );
    expect(res).toMatchObject({ configured: true, users: 2, sent: 1, skipped: 1 });
    expect(mailer.sendDigest).toHaveBeenCalledTimes(1);
  });
});
