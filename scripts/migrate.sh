#!/usr/bin/env bash
# Applies pending SQL migrations from backend/drizzle/migrations/ with
# version tracking, one transaction per file. Safe to re-run.
#
# Connection (first match wins):
#   DATABASE_URL=postgres://... ./scripts/migrate.sh   # TCP (CI, local with exposed ports)
#   ./scripts/migrate.sh                                # via `docker compose exec postgres`
#   COMPOSE_FILE=docker-compose.prod.yml ./scripts/migrate.sh   # prod deploy
#   PGDB=scratch ./scripts/migrate.sh                   # non-default database (testing)
#
# Existing databases that predate version tracking are base-stamped
# (all current files recorded as applied) instead of re-running history.
# Fails loudly on any error — deploy must stop before `up --build`.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATIONS_DIR="$ROOT_DIR/backend/drizzle/migrations"
SCHEMA_SQL="$ROOT_DIR/backend/schema.sql"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
PGDB="${PGDB:-cordlyx}"

# Files at or below LEGACY_CUTOFF are drizzle-kit history: they were applied
# with `drizzle-kit push` (never replayed linearly) and are NOT replayable
# as-is (e.g. 0000 and 0001 both CREATE api_keys). Fresh databases are built
# from backend/schema.sql; migrate.sh manages 0006+ (idempotent files).
# Existing databases get everything stamped (see baseline below).
LEGACY_CUTOFF="0005_charming_apocalypse"

log()  { echo "[migrate] $1"; }
fail() { echo "[migrate] ERROR: $1" >&2; exit 1; }

is_legacy() { [[ "$1" < "$LEGACY_CUTOFF" || "$1" == "$LEGACY_CUTOFF" ]]; }

if [ -n "${DATABASE_URL:-}" ]; then
  # shellcheck disable=SC2206
  PSQL=(psql "$DATABASE_URL")
else
  cd "$ROOT_DIR" || fail "cannot cd to $ROOT_DIR"
  # shellcheck disable=SC2206
  PSQL=(docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U cordlyx -d "$PGDB")
fi

# NOTE: < /dev/null is load-bearing. `docker compose exec` forwards stdin,
# so without it the first query would swallow the while-read loop's input
# and every subsequent check would silently never run.
psql_exec() { "${PSQL[@]}" -v ON_ERROR_STOP=1 -q "$@" < /dev/null; }
psql_file() { "${PSQL[@]}" -v ON_ERROR_STOP=1 -q --single-transaction < "$1"; }

# --- version tracking table ---
psql_exec -c "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now());" > /dev/null \
  || fail "cannot reach database"

applied="$(psql_exec -tAc "SELECT version FROM schema_migrations;" | tr -d ' \r' | grep -v '^$' || true)"

# --- baseline stamp for pre-existing databases ---
# Only LEGACY files are stamped: new managed files (0006+) are idempotent
# and must really run, otherwise their objects would be silently missing.
# Empty databases are rejected: fresh installs load backend/schema.sql first.
if [ -z "$applied" ]; then
  has_users="$(psql_exec -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='users';" | tr -d '[:space:]' || echo 0)"
  other_tables="$(psql_exec -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name NOT IN ('users', 'schema_migrations');" | tr -d '[:space:]' || echo 0)"
  if [ "${has_users:-0}" -eq 0 ] && [ "${other_tables:-0}" -eq 0 ]; then
    fail "empty database — load backend/schema.sql first, then run migrate.sh"
  fi
  if [ "${has_users:-0}" -ge 1 ]; then
    log "existing database detected — base-stamping legacy history (new files still apply below)"
    for f in "$MIGRATIONS_DIR"/[0-9]*.sql; do
      [ -f "$f" ] || continue
      v="$(basename "$f" .sql)"
      if ! is_legacy "$v"; then continue; fi
      psql_exec -c "INSERT INTO schema_migrations (version) VALUES ('$v') ON CONFLICT DO NOTHING;" > /dev/null
      log "  stamped $v"
    done
    applied="$(psql_exec -tAc "SELECT version FROM schema_migrations;" | tr -d ' \r' | grep -v '^$' || true)"
  fi
fi

if [ "${1:-}" = "--list" ]; then
  for f in "$MIGRATIONS_DIR"/[0-9]*.sql; do
    [ -f "$f" ] || continue
    v="$(basename "$f" .sql)"
    if is_legacy "$v"; then echo "  legacy $v (schema.sql covers fresh installs)";
    elif echo "$applied" | grep -qx "$v"; then echo "  applied $v";
    else echo "  PENDING $v"; fi
  done
  exit 0
fi

# --- apply pending, in order, one transaction each ---
count=0
for f in "$MIGRATIONS_DIR"/[0-9]*.sql; do
  [ -f "$f" ] || continue
  v="$(basename "$f" .sql)"
  if is_legacy "$v"; then continue; fi
  if echo "$applied" | grep -qx "$v"; then continue; fi
  log "applying $v ..."
  psql_file "$f" || fail "migration $v failed — database left unchanged for this file"
  psql_exec -c "INSERT INTO schema_migrations (version) VALUES ('$v');" > /dev/null
  log "  applied $v"
  count=$((count + 1))
done
log "$count migration(s) applied"

# --- sanity: every table from schema.sql must exist ---
missing=0
while read -r table; do
  [ -z "$table" ] && continue
  exists="$(psql_exec -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='$table';" | tr -d '[:space:]' || echo 0)"
  if [ "${exists:-0}" -lt 1 ]; then
    echo "[migrate] ERROR: table missing after migrations: $table" >&2
    missing=1
  fi
done < <(grep -oP 'CREATE TABLE \K\w+' "$SCHEMA_SQL" | sort -u)
[ "$missing" -eq 0 ] || fail "schema sanity check failed"
log "schema sanity check OK"
