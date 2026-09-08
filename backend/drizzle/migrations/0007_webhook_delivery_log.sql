-- 0007: webhook signing secrets + delivery log (D3).
-- Idempotent: safe to re-run.
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS secret character varying(64);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  webhook_id uuid NOT NULL,
  event character varying(100) NOT NULL,
  http_status integer,
  success boolean DEFAULT false NOT NULL,
  error_message text,
  duration_ms integer,
  attempt integer DEFAULT 1 NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT webhook_deliveries_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_created ON webhook_deliveries (webhook_id, created_at);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webhook_deliveries_webhook_id_webhooks_id_fk') THEN
    ALTER TABLE webhook_deliveries
      ADD CONSTRAINT webhook_deliveries_webhook_id_webhooks_id_fk
      FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE;
  END IF;
END
$$;
