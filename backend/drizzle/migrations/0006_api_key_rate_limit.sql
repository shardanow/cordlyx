-- 0006: per-API-key rate limit budget (D2).
-- Idempotent: safe to re-run.
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS rate_limit_per_min integer DEFAULT 120 NOT NULL;
