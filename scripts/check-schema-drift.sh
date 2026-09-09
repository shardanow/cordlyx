#!/usr/bin/env bash
# Fails if Drizzle schema (backend/src/database/schema/*.ts) drifts from what
# backend/schema.sql + backend/drizzle/migrations/*.sql produce.
#
# Builds two scratch databases on the same server:
#   A = schema.sql + scripts/migrate.sh   (the deploy path)
#   B = drizzle-kit push --force          (the schema.ts truth)
# then diffs canonical pg_dump -s output, modulo known intentional diffs
# (search_vector generated column, pg_trgm extension, migration trackers).
#
# Usage:
#   DRIFT_BASE_URL=postgres://cordlyx:cordlyx@localhost:5432/postgres ./scripts/check-schema-drift.sh
#
# Requires: backend/dist built (drizzle-kit reads the compiled schema).
# Any diff means a schema.ts change shipped without a migration file
# (or a stale schema.sql) — add/fix the migration, never edit prod by hand.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BASE_URL="${DRIFT_BASE_URL:?set DRIFT_BASE_URL, e.g. postgres://cordlyx:cordlyx@localhost:5432/postgres}"
TS="$$"
DB_A="drift_a_${TS}"
DB_B="drift_b_${TS}"

log() { echo "[drift] $1"; }
fail() { echo "[drift] ERROR: $1" >&2; exit 1; }

cleanup() {
  psql "$BASE_URL" -q -c "DROP DATABASE IF EXISTS \"$DB_A\";" 2>/dev/null || true
  psql "$BASE_URL" -q -c "DROP DATABASE IF EXISTS \"$DB_B\";" 2>/dev/null || true
}
trap cleanup EXIT

[ -f "$ROOT_DIR/backend/dist/src/database/schema/index.js" ] \
  || fail "backend/dist missing — run 'npm run build -w backend' first"

log "creating scratch databases"
psql "$BASE_URL" -q -c "CREATE DATABASE \"$DB_A\";" < /dev/null
psql "$BASE_URL" -q -c "CREATE DATABASE \"$DB_B\";" < /dev/null

URL_A="${BASE_URL%/postgres}/$DB_A"
URL_B="${BASE_URL%/postgres}/$DB_B"

log "A: schema.sql + migrate.sh"
psql "$URL_A" -q -v ON_ERROR_STOP=1 < "$ROOT_DIR/backend/schema.sql" > /dev/null
DATABASE_URL="$URL_A" "$ROOT_DIR/scripts/migrate.sh" > /dev/null \
  || fail "migrate.sh failed on schema.sql-built database"

log "B: drizzle-kit push from schema.ts"
(cd "$ROOT_DIR/backend" && DATABASE_URL="$URL_B" npx drizzle-kit push --force > /dev/null) \
  || fail "drizzle-kit push failed"

# Canonical text form: drop comments/owners/privs, strip trailing commas
# (so removing an excluded line can't leave a dangling-comma diff), then
# drop known intentional diffs. Both dumps go through the same filter,
# so anything left is real drift.
normalize() {
  sed -E '/^CREATE TABLE public\.(schema_migrations|data_migrations) \($/,/^\);$/d' "$1" \
    | grep -v '^--' \
    | grep -v -E '^(CREATE EXTENSION|COMMENT ON EXTENSION)' \
    | grep -v -E 'search_vector|idx_items_search|schema_migrations|data_migrations' \
    | sed 's/,\s*$//' \
    | grep -v '^[[:space:]]*$'
}

if diff -u <(pg_dump -s -O -x "$URL_A" | normalize /dev/stdin) <(pg_dump -s -O -x "$URL_B" | normalize /dev/stdin) > /tmp/drift.diff; then
  log "no drift: schema.ts == schema.sql + migrations"
else
  echo "[drift] SCHEMA DRIFT DETECTED (- deploy path, + schema.ts):" >&2
  cat /tmp/drift.diff >&2
  fail "package the schema change as backend/drizzle/migrations/NNNN_*.sql and update backend/schema.sql"
fi
