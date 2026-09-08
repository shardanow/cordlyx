import { test, expect, request } from '@playwright/test';

/**
 * API contract: mirrors the flows documented in USER_GUIDE.md / ARCHITECTURE.md
 * against a live backend (http://localhost:4000). Self-contained — creates its
 * own user + project with unique names, so it never depends on seed data.
 * UI specs (auth, quick-create-board) cover the browser; this covers the API.
 */
const API = 'http://localhost:4000/api/v1/';

test.describe('API contract', () => {
  test('documented flows work end to end', async () => {
    const stamp = Date.now();
    const api = await request.newContext({ baseURL: API });
    const docs = await request.newContext({ baseURL: 'http://localhost:4000/' });
    const email = `contract-${stamp}@test.com`;
    const slug = `contract-${stamp}`;

    let jwt = '';
    await test.step('register (returns JWT)', async () => {
      const reg = await api.post('auth/register', {
        data: { username: `ct${stamp}`, email, password: 'password123', name: 'Contract' },
      });
      expect(reg.ok()).toBeTruthy();
      const body = await reg.json();
      expect(typeof body.accessToken).toBe('string');
      jwt = body.accessToken;
    });
    const authed = await request.newContext({
      baseURL: API,
      extraHTTPHeaders: { Authorization: `Bearer ${jwt}` },
    });
    let typeId = '';

    await test.step('create project + read config', async () => {
      const res = await authed.post('projects', { data: { name: 'Contract', slug } });
      expect(res.ok()).toBeTruthy();
      const types = await (await authed.get(`projects/${slug}/types`)).json();
      typeId = types.find((t: any) => t.name === 'Task').id;
      expect(typeId).toBeTruthy();
    });

    await test.step('items CRUD + validation', async () => {
      const bad = await authed.post(`projects/${slug}/items`, { data: { title: '' } });
      expect(bad.status()).toBe(400);

      const created = await authed.post(`projects/${slug}/items`, {
        data: { title: 'Contract item', typeId },
      });
      expect(created.status()).toBe(201);
      const item = await created.json();
      expect(item.sequenceNum).toBe(1);

      const bySeq = await authed.get(`projects/${slug}/items/1`);
      expect((await bySeq.json()).title).toBe('Contract item');

      const patched = await authed.patch(`projects/${slug}/items/${item.id}`, {
        data: { description: 'updated' },
      });
      expect(patched.ok()).toBeTruthy();

      const listed = await (await authed.get(`projects/${slug}/items`)).json();
      expect(listed.data.length).toBeGreaterThanOrEqual(1);
    });

    await test.step('items bulk + export + import idempotency', async () => {
      const bulk = await authed.post(`projects/${slug}/items/bulk`, {
        data: { items: [{ title: 'Bulk A', typeId }, { title: 'Contract item', typeId }] },
      });
      expect(bulk.ok()).toBeTruthy();
      expect(await bulk.json()).toMatchObject({ meta: { created: 1, skipped: 1, failed: 0 } });

      const exp = await authed.get(`projects/${slug}/items/export?format=csv`);
      expect(exp.ok()).toBeTruthy();
      expect(exp.headers()['content-disposition']).toContain(`${slug}-items.csv`);
      const csv = await exp.text();
      expect(csv).toContain('Bulk A');

      const imp = await authed.post(`projects/${slug}/items/import?dryRun=true`, {
        multipart: { file: { name: 'items.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) } },
      });
      expect(await imp.json()).toMatchObject({ meta: { dryRun: true } });
    });

    await test.step('plans + config transfer', async () => {
      const bulk = await authed.post(`projects/${slug}/plans/bulk`, {
        data: { items: [{ name: 'R1', type: 'release' }, { name: 'R1', type: 'release' }] },
      });
      expect(await bulk.json()).toMatchObject({ meta: { created: 1, skipped: 1 } });

      const cfg = await (await authed.get(`projects/${slug}/config/export`)).json();
      expect(cfg.types.length).toBeGreaterThan(0);
      const cfgImp = await authed.post(`projects/${slug}/config/import`, {
        multipart: { file: { name: 'config.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(cfg)) } },
      });
      expect(await cfgImp.json()).toMatchObject({ meta: { created: 0, failed: 0 } });
    });

    let roadmapId = '';
    await test.step('roadmaps transfer', async () => {
      const rm = await (
        await authed.post(`projects/${slug}/roadmaps`, {
          data: { name: 'RM1', startDate: '2026-01-01', endDate: '2026-12-31' },
        })
      ).json();
      roadmapId = rm.id;
      const lane = await (
        await authed.post(`projects/${slug}/roadmaps/${roadmapId}/lanes`, { data: { name: 'L1' } })
      ).json();
      const items = await (await authed.get(`projects/${slug}/items`)).json();
      const sched = await authed.post(`projects/${slug}/roadmaps/${roadmapId}/schedule`, {
        data: { itemIds: [items.data[0].id], laneId: lane.id },
      });
      expect(sched.ok()).toBeTruthy();

      const exp = await (await authed.get(`projects/${slug}/roadmaps/export?format=json`)).json();
      expect(exp).toHaveLength(1);
      expect(exp[0].entries).toHaveLength(1);

      exp[0].name = 'RM-copy';
      const imp = await authed.post(`projects/${slug}/roadmaps/import`, {
        multipart: { file: { name: 'rm.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exp)) } },
      });
      expect(await imp.json()).toMatchObject({ meta: { created: 1, failed: 0 } });
    });

    await test.step('snapshot round-trip + merge idempotency', async () => {
      const snap = await (await authed.get(`projects/${slug}/snapshot/export`)).json();
      expect(snap.version).toBe(1);
      expect(snap.items.length).toBeGreaterThanOrEqual(2);

      const dstSlug = `${slug}-dst`;
      const created = await authed.post(`projects/snapshot/import-new?slug=${dstSlug}`, {
        multipart: { file: { name: 'snap.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(snap)) } },
      });
      expect(created.status()).toBe(201);
      const dst = await (await authed.get(`projects/${dstSlug}/snapshot/export`)).json();
      expect(dst.items).toHaveLength(snap.items.length);
      expect(dst.relations).toHaveLength(snap.relations.length);

      const merge = await authed.post(`projects/${dstSlug}/snapshot/import`, {
        multipart: { file: { name: 'snap.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(snap)) } },
      });
      const sections = (await merge.json()).meta.sections;
      expect(sections.items).toMatchObject({ created: 0, failed: 0 });
      expect(sections.roadmaps.created).toBe(0);
    });

    await test.step('stats, views, prefs, sync, etag', async () => {
      const stats = await (await authed.get(`projects/${slug}/stats`)).json();
      expect(stats.total).toBeGreaterThanOrEqual(2);
      expect(stats.byStatus.reduce((n: number, s: any) => n + s.count, 0)).toBe(stats.total);

      const view = await (
        await authed.post(`projects/${slug}/views`, {
          data: { name: 'Contract view', filters: { typeId: '' }, isShared: true },
        })
      ).json();
      expect(view.id).toBeTruthy();
      const views = await (await authed.get(`projects/${slug}/views`)).json();
      expect(views.length).toBeGreaterThanOrEqual(1);
      const def = await authed.post(`projects/${slug}/views/${view.id}/set-default`, { data: {} });
      expect(def.ok()).toBeTruthy();

      const prefs = await authed.put(`notifications/prefs/${slug}`, {
        data: { muted: true, emailDigest: false, digestHour: 9 },
      });
      expect(prefs.ok()).toBeTruthy();
      const mine = await (await authed.get('notifications/prefs')).json();
      expect(mine.find((p: any) => p.projectSlug === slug)?.muted).toBe(true);
      await authed.put(`notifications/prefs/${slug}`, { data: { muted: false } });

      const digest = await authed.post('notifications/digest/send', { data: {} });
      expect([200, 503]).toContain(digest.status());

      const epoch = new Date(0).toISOString();
      const sync1 = await (await authed.get(`projects/${slug}/sync?since=${encodeURIComponent(epoch)}`)).json();
      expect(sync1.data.length).toBeGreaterThanOrEqual(2);
      expect(sync1.meta.serverTime).toBeTruthy();
      const sync2 = await (
        await authed.get(`projects/${slug}/sync?since=${encodeURIComponent(sync1.meta.serverTime)}`)
      ).json();
      expect(sync2.data).toHaveLength(0);
      expect(sync2.meta.hasMore).toBe(false);

      const list1 = await authed.get(`projects/${slug}/items`);
      const etag = list1.headers()['etag'];
      expect(etag).toMatch(/^W\/"/);
      const etagCtx = await request.newContext({
        baseURL: API,
        extraHTTPHeaders: { Authorization: `Bearer ${jwt}`, 'If-None-Match': etag },
      });
      const list2 = await etagCtx.get(`projects/${slug}/items`);
      expect(list2.status()).toBe(304);
      await etagCtx.dispose();
    });

    await test.step('API key auth (JWT alternative)', async () => {      const created = await authed.post('api-keys', { data: { name: 'contract' } });
      expect(created.status()).toBe(201);
      const { key } = await created.json();
      expect(key.startsWith('clx_')).toBe(true);

      const keyed = await request.newContext({
        baseURL: API,
        extraHTTPHeaders: { 'X-API-Key': key },
      });
      const listed = await keyed.get(`projects/${slug}/items`);
      expect(listed.ok()).toBeTruthy();

      const anon = await request.newContext({ baseURL: API });
      const bad = await anon.get(`projects/${slug}/items`);
      expect(bad.status()).toBe(401);
      await anon.dispose();
      await keyed.dispose();
    });

    await test.step('OpenAPI docs expose transfer routes', async () => {
      const res = await docs.get('api/docs-json');
      expect(res.ok()).toBeTruthy();
      const spec = await res.json();
      for (const p of [
        '/api/v1/projects/{projectSlug}/items/bulk',
        '/api/v1/projects/{projectSlug}/items/import',
        '/api/v1/projects/{projectSlug}/plans/bulk',
        '/api/v1/projects/{projectSlug}/config/import',
        '/api/v1/projects/{projectSlug}/roadmaps/import',
        '/api/v1/projects/{projectSlug}/snapshot/export',
        '/api/v1/projects/snapshot/import-new',
      ]) {
        expect(spec.paths[p], `missing ${p}`).toBeTruthy();
      }
      await docs.dispose();
    });

    await authed.dispose();
    await api.dispose();
  });

  test('auth matrix: 401/403, scoped keys, 204 deletes, refresh token types', async () => {
    const stamp = Date.now();
    const api = await request.newContext({ baseURL: API });

    async function makeUser(tag: string) {
      const email = `matrix-${tag}-${stamp}@test.com`;
      const reg = await api.post('auth/register', {
        data: { username: `mx${tag}${stamp}`, email, password: 'password123', name: 'Matrix' },
      });
      expect(reg.ok()).toBeTruthy();
      const body = await reg.json();
      const ctx = await request.newContext({
        baseURL: API,
        extraHTTPHeaders: { Authorization: `Bearer ${body.accessToken}` },
      });
      return { email, jwt: body.accessToken as string, refresh: body.refreshToken as string, ctx };
    }

    const alice = await makeUser('a');
    const bob = await makeUser('b');
    const projA = (await (await alice.ctx.post('projects', { data: { name: 'A', slug: `mx-a-${stamp}` } })).json()) as any;

    // 401: no token
    const anon = await request.newContext({ baseURL: API });
    expect((await anon.get(`projects/${projA.slug}/items`)).status()).toBe(401);

    // 403: valid token, foreign project
    expect((await bob.ctx.get(`projects/${projA.slug}/items`)).status()).toBe(403);
    expect((await bob.ctx.get(`projects/${projA.slug}`)).status()).toBe(403);

    // 403: scoped API key used outside its project
    const projB = (await (await alice.ctx.post('projects', { data: { name: 'B', slug: `mx-b-${stamp}` } })).json()) as any;
    const scopedKey = (await (
      await alice.ctx.post('api-keys', { data: { name: 'scoped', projectId: projB.id } })
    ).json()) as any;
    const scoped = await request.newContext({
      baseURL: API,
      extraHTTPHeaders: { 'X-API-Key': scopedKey.key },
    });
    expect((await scoped.get(`projects/${projB.slug}/items`)).status()).toBe(200);
    expect((await scoped.get(`projects/${projA.slug}/items`)).status()).toBe(403);

    // 401: invalid API key
    const bogus = await request.newContext({ baseURL: API, extraHTTPHeaders: { 'X-API-Key': 'clx_nope' } });
    expect((await bogus.get(`projects/${projB.slug}/items`)).status()).toBe(401);

    // refresh accepts only refresh tokens
    const refreshOk = await api.post('auth/refresh', { data: { refreshToken: alice.refresh } });
    expect(refreshOk.ok()).toBeTruthy();
    const refreshBad = await api.post('auth/refresh', { data: { refreshToken: alice.jwt } });
    expect(refreshBad.status()).toBe(401);

    // 204: account deletion has no body
    const del = await alice.ctx.delete('users/me');
    expect(del.status()).toBe(204);

    await anon.dispose();
    await scoped.dispose();
    await bogus.dispose();
    await alice.ctx.dispose();
    await bob.ctx.dispose();
    await api.dispose();
  });
});
