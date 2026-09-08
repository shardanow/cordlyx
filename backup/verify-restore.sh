#!/usr/bin/env bash
# Verifies a pg_dump backup by restoring it into a scratch database
# and running sanity checks. A backup that was never restore-tested
# is not a backup.
#
# Usage:
#   DATABASE_URL=postgres://cordlyx:cordlyx@localhost:5432/cordlyx \
#     ./backup/verify-restore.sh backups/dump_20240101_120000.sql
#
# Optional:
#   EXPECT_SEEDED=1  — also assert seed data is present (users + demo project)
#
# Requirements: postgresql-client (psql, createdb, dropdb) with TCP access.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set (connection to the source server)}"
DUMP_FILE="${1:?Usage: verify-restore.sh <dump.sql>}"
[ -f "$DUMP_FILE" ] || { echo "[VERIFY] Dump file not found: $DUMP_FILE" >&2; exit 1; }

BASE_URL="${DATABASE_URL%/*}"
SCRATCH_DB="cordlyx_verify_$$"
SCRATCH_URL="$BASE_URL/$SCRATCH_DB"

echo "[VERIFY] Restoring $DUMP_FILE into scratch database $SCRATCH_DB..."
psql "$BASE_URL/postgres" -qc "CREATE DATABASE \"$SCRATCH_DB\"" 2>&1 | grep -v "already exists" || true

cleanup() {
    echo "[VERIFY] Dropping scratch database..."
    psql "$BASE_URL/postgres" -qc "DROP DATABASE IF EXISTS \"$SCRATCH_DB\"" >/dev/null 2>&1 || true
}
trap cleanup EXIT

psql -v ON_ERROR_STOP=1 -q "$SCRATCH_URL" -f "$DUMP_FILE" > /dev/null
echo "[VERIFY] Restore OK"

fail=0
check() {
    local label="$1"; shift
    local result
    result=$(psql -tAc "$SCRATCH_URL" "$@" 2>&1) || { echo "[VERIFY] FAIL: $label (query error: $result)"; fail=1; return; }
    echo "[VERIFY] $label: $result"
}

TABLES=$(psql -tAc "$SCRATCH_URL" "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo "[VERIFY] public tables: $TABLES"
if [ "${TABLES:-0}" -lt 20 ]; then echo "[VERIFY] FAIL: expected >= 20 tables"; fail=1; fi

check "search_vector column" "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'search_vector';"
check "users" "SELECT COUNT(*) FROM users;"
check "projects" "SELECT COUNT(*) FROM projects;"
check "items" "SELECT COUNT(*) FROM items WHERE deleted_at IS NULL;"

if [ "${EXPECT_SEEDED:-0}" = "1" ]; then
    DEMO=$(psql -tAc "$SCRATCH_URL" "SELECT COUNT(*) FROM projects WHERE slug = 'demo';")
    echo "[VERIFY] demo project rows: $DEMO"
    if [ "${DEMO:-0}" -lt 1 ]; then echo "[VERIFY] FAIL: seed data missing (no demo project)"; fail=1; fi
    SEEDUSERS=$(psql -tAc "$SCRATCH_URL" "SELECT COUNT(*) FROM users;")
    if [ "${SEEDUSERS:-0}" -lt 2 ]; then echo "[VERIFY] FAIL: seed data missing (< 2 users)"; fail=1; fi
fi

if [ "$fail" -ne 0 ]; then
    echo "[VERIFY] FAILED" >&2
    exit 1
fi
echo "[VERIFY] OK — backup restores cleanly"
