#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$(cd "$(dirname "$0")/.." && pwd)/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-cordlyx-postgres}"
API_CONTAINER="${API_CONTAINER:-cordlyx-api}"
COMPOSE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

log_info()  { echo -e "${CYAN}[BACKUP]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[BACKUP]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[BACKUP]${NC}  $1"; }
log_error() { echo -e "${RED}[BACKUP]${NC}  $1"; }

mkdir -p "$BACKUP_DIR"

container_exists() {
    docker container inspect "$1" &>/dev/null
}

container_running() {
    docker container inspect -f '{{.State.Running}}' "$1" 2>/dev/null | grep -q true
}

container_start() {
    local name=$1
    log_info "Starting $name for backup..."
    docker start "$name" >/dev/null
}

container_stop() {
    local name=$1
    log_info "Stopping $name..."
    docker stop "$name" >/dev/null
}

wait_for_pg() {
    local i=0
    while ! docker exec -i "$POSTGRES_CONTAINER" pg_isready -U cordlyx &>/dev/null; do
        sleep 1
        i=$((i + 1))
        if [ "$i" -ge 15 ]; then
            log_error "PostgreSQL did not become ready within 15s"
            return 1
        fi
    done
}

exec_in() {
    local container=$1; shift
    local ps_out; ps_out=$(docker compose ps --status running 2>/dev/null) || true
    if echo "$ps_out" | grep -q "$container" 2>/dev/null; then
        docker compose exec -T "$container" "$@"
    else
        docker exec -i "$container" "$@"
    fi
}

exec_pg() {
    exec_in postgres pg_dump -U cordlyx --clean --if-exists cordlyx
}

exec_api_tar() {
    exec_in api tar -czf - -C /app/data/uploads .
}

backup_db() {
    if ! container_exists "$POSTGRES_CONTAINER"; then
        log_warn "Container $POSTGRES_CONTAINER does not exist — skipping database backup"
        return 0
    fi

    local ts; ts=$(date +%Y%m%d_%H%M%S)
    local filename="dump_${ts}.sql"
    local filepath="$BACKUP_DIR/$filename"
    local started=false

    if ! container_running "$POSTGRES_CONTAINER"; then
        container_start "$POSTGRES_CONTAINER"
        started=true
    fi

    wait_for_pg || { [ "$started" = true ] && container_stop "$POSTGRES_CONTAINER"; return 0; }

    log_info "Backing up database..."
    exec_pg > "$filepath"
    log_ok "Database backup saved: $filename ($(du -h "$filepath" | cut -f1))"

    if [ "$started" = true ]; then
        container_stop "$POSTGRES_CONTAINER"
    fi
}

backup_uploads() {
    local ts; ts=$(date +%Y%m%d_%H%M%S)
    local dirname="uploads_${ts}"

    if [ -d "$COMPOSE_DIR/data/uploads" ] && [ "$(ls -A "$COMPOSE_DIR/data/uploads" 2>/dev/null)" ]; then
        local dest="$BACKUP_DIR/$dirname"
        log_info "Backing up uploads (local)..."
        cp -a "$COMPOSE_DIR/data/uploads" "$dest"
        log_ok "Uploads backup saved: $dirname ($(du -sh "$dest" | cut -f1))"
        return 0
    fi

    if ! container_exists "$API_CONTAINER"; then
        log_warn "No local uploads directory and container $API_CONTAINER does not exist — skipping uploads backup"
        return 0
    fi

    local archive="$BACKUP_DIR/${dirname}.tar.gz"
    local started=false

    if ! container_running "$API_CONTAINER"; then
        container_start "$API_CONTAINER"
        started=true
    fi

    log_info "Backing up uploads (Docker volume)..."
    exec_api_tar > "$archive"
    log_ok "Uploads backup saved: ${dirname}.tar.gz ($(du -h "$archive" | cut -f1))"

    if [ "$started" = true ]; then
        container_stop "$API_CONTAINER"
    fi
}

cleanup_old() {
    log_info "Cleaning up backups older than $RETENTION_DAYS days..."
    local found=false
    for f in "$BACKUP_DIR"/dump_*.sql; do
        [ -f "$f" ] || continue
        if [ "$(find "$f" -mtime +"$RETENTION_DAYS" -print)" ]; then
            rm -f "$f"; log_info "  Removed: $(basename "$f")"; found=true
        fi
    done
    for d in "$BACKUP_DIR"/uploads_*/; do
        [ -d "$d" ] || continue
        local base; base=$(basename "$d")
        if [ "$(find "$d" -maxdepth 0 -mtime +"$RETENTION_DAYS" -print)" ]; then
            rm -rf "$d"; log_info "  Removed: $base"; found=true
        fi
    done
    for f in "$BACKUP_DIR"/uploads_*.tar.gz; do
        [ -f "$f" ] || continue
        if [ "$(find "$f" -mtime +"$RETENTION_DAYS" -print)" ]; then
            rm -f "$f"; log_info "  Removed: $(basename "$f")"; found=true
        fi
    done
    if [ "$found" = false ]; then log_info "  Nothing to clean up"; fi
    log_ok "Cleanup complete"
}

case "${1:-}" in
    --db)
        backup_db
        ;;
    --uploads)
        backup_uploads
        ;;
    --cleanup)
        cleanup_old
        ;;
    --help|-h)
        echo "CordLyx Backup Tool"
        echo ""
        echo "Usage:"
        echo "  $0             Full backup (DB + uploads + cleanup)"
        echo "  $0 --db        Database only"
        echo "  $0 --uploads   Uploads only"
        echo "  $0 --cleanup   Remove backups older than $RETENTION_DAYS days"
        echo "  $0 --help      Show this help"
        echo ""
        echo "Environment:"
        echo "  BACKUP_DIR=$BACKUP_DIR"
        echo "  RETENTION_DAYS=$RETENTION_DAYS"
        echo "  POSTGRES_CONTAINER=$POSTGRES_CONTAINER"
        echo "  API_CONTAINER=$API_CONTAINER"
        ;;
    *)
        log_info "=== Full backup ==="
        cd "$COMPOSE_DIR" || { log_error "Failed to cd to project root"; exit 1; }
        backup_db
        backup_uploads
        cleanup_old
        log_ok "Full backup complete"
        ;;
esac
