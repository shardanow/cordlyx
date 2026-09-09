# Data migrations

Eager data backfills live here as numbered, **idempotent, resumable, batched**
SQL scripts (`0001_<name>.sql`, …). `scripts/migrate.sh` runs pending files
after the schema migrations, one transaction each, tracked in the
`data_migrations` table. Safe to re-run; a failure stops the deploy before
new code starts.

Rules:

- Default to **lazy conversion** at read/write time (no backfill needed).
  Only add a file here when history must actually be rewritten.
- Every script must be re-runnable: `INSERT … ON CONFLICT DO NOTHING`,
  `UPDATE … WHERE <not-yet-migrated>`, `LIMIT` batches with a stable order.
- Never run these by hand against prod — the deploy workflow is the only runner.
