-- 0010: refresh-token denylist for logout.
-- Idempotent: safe to re-run.
CREATE TABLE IF NOT EXISTS revoked_refresh_tokens (
  jti character varying(64) NOT NULL,
  user_id uuid NOT NULL,
  expires_at timestamp NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT revoked_refresh_tokens_pkey PRIMARY KEY (jti)
);

CREATE INDEX IF NOT EXISTS idx_revoked_refresh_tokens_user ON revoked_refresh_tokens (user_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'revoked_refresh_tokens_user_id_users_id_fk') THEN
    ALTER TABLE revoked_refresh_tokens
      ADD CONSTRAINT revoked_refresh_tokens_user_id_users_id_fk
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END
$$;
