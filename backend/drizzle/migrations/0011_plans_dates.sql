-- 0011: plans date range (sprint/scope support) + items parent index.
-- Idempotent: safe to re-run. DROP+CREATE converges the index definition
-- even where a previous manual step created a variant under the same name.
ALTER TABLE plans ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS end_date DATE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_plans_dates') THEN
    ALTER TABLE plans
      ADD CONSTRAINT chk_plans_dates
      CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date);
  END IF;
END
$$;

DROP INDEX IF EXISTS idx_items_parent;
CREATE INDEX IF NOT EXISTS idx_items_parent ON items (parent_id) WHERE deleted_at IS NULL;
