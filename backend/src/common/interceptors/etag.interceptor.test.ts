import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { EtagInterceptor } from './etag.interceptor.js';
import { NotModifiedException } from '../not-modified.exception.js';

function ctxOf(method: string, ifNoneMatch?: string) {
  const headers: Record<string, string> = {};
  const res = { setHeader: vi.fn() };
  const req = { method, headers: ifNoneMatch ? { ...headers, 'if-none-match': ifNoneMatch } : headers };
  return {
    context: { switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }) } as any,
    req,
    res,
  };
}

function run(interceptor: EtagInterceptor, context: any, body: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    interceptor.intercept(context, { handle: () => of(body) } as any).subscribe({ next: resolve, error: reject });
  });
}

function etagOf(res: { setHeader: ReturnType<typeof vi.fn> }): string {
  expect(res.setHeader).toHaveBeenCalledWith('ETag', expect.stringMatching(/^W\/".+"$/));
  return res.setHeader.mock.calls[0][1] as string;
}

describe('EtagInterceptor', () => {
  const interceptor = new EtagInterceptor();

  it('sets ETag and passes object bodies through', async () => {
    const { context, res } = ctxOf('GET');
    const body = { data: [1, 2] };
    const out = await run(interceptor, context, body);
    expect(out).toEqual(body);
    etagOf(res);
  });

  it('throws NotModifiedException on If-None-Match hit', async () => {
    const first = ctxOf('GET');
    await run(interceptor, first.context, { data: [] });
    const etag = etagOf(first.res);

    const second = ctxOf('GET', etag);
    await expect(run(interceptor, second.context, { data: [] })).rejects.toBeInstanceOf(NotModifiedException);
    // ETag is set even on the 304 path
    etagOf(second.res);
  });

  it('hashes string bodies too (CSV/JSONL exports)', async () => {
    const { context, res } = ctxOf('GET');
    const out = await run(interceptor, context, 'a,b');
    expect(out).toBe('a,b');
    etagOf(res);
  });

  it('returns 304 for string bodies on If-None-Match hit', async () => {
    const first = ctxOf('GET');
    await run(interceptor, first.context, 'a,b');
    const etag = etagOf(first.res);

    const second = ctxOf('GET', etag);
    await expect(run(interceptor, second.context, 'a,b')).rejects.toBeInstanceOf(NotModifiedException);
  });

  it('leaves non-GET requests alone', async () => {
    const { context, res } = ctxOf('POST');
    const out = await run(interceptor, context, { a: 1 });
    expect(out).toEqual({ a: 1 });
    expect(res.setHeader).not.toHaveBeenCalled();
  });
});
