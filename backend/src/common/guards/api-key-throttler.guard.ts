import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
  InjectThrottlerOptions,
  InjectThrottlerStorage,
} from '@nestjs/throttler';
import { ApiKeysService } from '../../modules/api-keys/api-keys.service.js';

/**
 * Requests/min budget: the key's own limit when resolved, else the default.
 * Overridable via THROTTLE_LIMIT (load testing / e2e headroom); prod default 120.
 * (120 fits SPA prefetch bursts: ~12 requests per navigation. Auth brute-force
 * protection lives in the isolated 'auth' bucket and is unaffected.)
 */
export function apiKeyLimit(context: ExecutionContext): number {
  const override = Number.parseInt(process.env.THROTTLE_LIMIT ?? '', 10);
  if (Number.isFinite(override) && override > 0) return override;
  return context.switchToHttp().getRequest().apiKeyRateLimit ?? 120;
}

/**
 * Tracker: API keys by key id (shared IPs must not share a budget),
 * everyone else by client IP (same as the default tracker).
 */
export function apiKeyTracker(req: Record<string, unknown>): string {
  if (typeof req.apiKeyId === 'string' && req.apiKeyId) return `apikey-${req.apiKeyId}`;
  const ips = req.ips as string[] | undefined;
  if (ips?.length) return ips[0] as string;
  return req.ip as string;
}

/**
 * Global rate-limit guard with per-API-key limits.
 *
 * Resolves X-API-Key before throttling so keyed requests are tracked
 * by key id (not shared client IP) with the key's own requests/min
 * budget (api_keys.rate_limit_per_min, default 120).
 *
 * Key validation results are cached 60s inside ApiKeysService; the auth
 * guard reuses the same cache, so steady-state cost is ~zero extra DB hits.
 */
@Injectable()
export class ApiKeyThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly apiKeysService: ApiKeysService,
  ) {
    super(options, storageService, reflector);
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const rawKey = request.headers?.['x-api-key'] as string | undefined;
    if (typeof rawKey === 'string' && rawKey.startsWith('clx_')) {
      try {
        const key = await this.apiKeysService.validateKey(rawKey);
        if (key) {
          request.apiKeyId = key.keyId;
          request.apiKeyRateLimit = key.rateLimitPerMin;
        }
      } catch {
        // Validation failure must not break throttling; the auth guard rejects later.
      }
    }
    return super.canActivate(context);
  }
}
