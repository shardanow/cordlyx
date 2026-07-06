#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

cleanup() {
    log_info "Shutting down services..."
    if [ -f /tmp/cordlyx_pids ]; then
        while IFS= read -r pid; do
            kill "$pid" 2>/dev/null || true
        done < /tmp/cordlyx_pids
        rm -f /tmp/cordlyx_pids
    fi
    log_ok "All processes stopped"
}

trap cleanup EXIT INT TERM

save_pid() {
    echo "$!" >> /tmp/cordlyx_pids
}

check_deps() {
    if ! command -v docker &>/dev/null; then
        log_error "Docker is required. Install: https://docs.docker.com/get-docker/"
        exit 1
    fi
    if ! command -v node &>/dev/null; then
        log_error "Node.js is required. Install: https://nodejs.org/"
        exit 1
    fi
    if ! command -v npm &>/dev/null; then
        log_error "npm is required"
        exit 1
    fi
}

check_env() {
    if [ ! -f .env ]; then
        log_info "Creating .env from .env.example..."
        cp .env.example .env
        log_warn "Edit .env to set JWT_SECRET and other secrets"
    fi
}

check_port() {
    local port=$1
    if lsof -i :"$port" &>/dev/null 2>&1; then
        log_error "Port $port is already in use"
        return 1
    fi
    return 0
}

start_infra() {
    log_info "Starting PostgreSQL + Redis..."
    docker compose up -d postgres redis
    log_info "Waiting for PostgreSQL to be ready..."
    until docker compose exec postgres pg_isready -U cordlyx &>/dev/null; do
        sleep 1
    done
    log_ok "PostgreSQL is ready"
    # Ensure test database exists (separate DB so tests don't wipe dev data)
    docker compose exec -T postgres psql -U cordlyx -tc \
        "SELECT 1 FROM pg_database WHERE datname = 'cordlyx_test'" | grep -q 1 \
        || docker compose exec -T postgres psql -U cordlyx -c "CREATE DATABASE cordlyx_test" 2>/dev/null
    log_info "Waiting for Redis to be ready..."
    until docker compose exec redis redis-cli ping &>/dev/null; do
        sleep 1
    done
    log_ok "Redis is ready"
}

build_shared() {
    log_info "Building shared package..."
    npm run build -w packages/shared 2>/dev/null
    log_ok "Shared package built"
}

db_push() {
    log_info "Pushing database schema..."
    cd "$ROOT_DIR/backend"
    # Build shared + backend only if compiled output is missing
    if [ ! -f "dist/src/main.js" ]; then
        log_info "No compiled output found — building first..."
        npm run build -w "$ROOT_DIR/packages/shared" 2>/dev/null
        npm run build 2>/dev/null
    fi
    # --force skips the interactive confirmation prompt for automated use
    npx drizzle-kit push --force 2>&1
    cd "$ROOT_DIR"
    # Drizzle doesn't support GENERATED ALWAYS AS columns natively.
    # Restore search_vector generated column + GIN index after every push.
    log_info "Applying generated columns and custom indexes..."
    docker compose exec -T postgres psql -U cordlyx cordlyx -c "
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_items_search ON items USING gin(search_vector);
" 2>&1 | grep -v "^$" || true
    log_ok "Database schema pushed"
}

db_seed() {
    log_info "Seeding database..."
    cd "$ROOT_DIR/backend"
    # Use compiled seed (built by 'npm run build -w backend')
    if [ ! -f "dist/src/database/seed.js" ]; then
        log_info "Compiling backend to run seed..."
        npm run build 2>/dev/null
    fi
    # Fix .ts → .js in compiled requires (SWC preserves .ts extensions in CJS output)
    find dist -name "*.js" -exec sed -i "s/require(\"\(.*\)\.ts\")/require(\"\1.js\")/g" {} \; 2>/dev/null || true
    node dist/src/database/seed.js 2>&1
    cd "$ROOT_DIR"
    log_ok "Database seeded"
}

db_reset() {
    log_info "Resetting database..."
    docker compose exec -T postgres psql -U cordlyx -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" 2>/dev/null
    db_push
    db_seed
    log_ok "Database reset complete"
}

db_dump() {
    "$ROOT_DIR/backup/backup.sh" --db
}

db_restore() {
    local backup_dir="$ROOT_DIR/backups"
    if [ ! -d "$backup_dir" ] || [ -z "$(ls -A "$backup_dir"/*.sql 2>/dev/null)" ]; then
        log_error "No dump files found in backups/"
        return 1
    fi
    echo ""
    echo -e "${CYAN}Available dumps:${NC}"
    select f in "$backup_dir"/*.sql; do
        if [ -n "$f" ]; then
            log_info "Restoring from $(basename "$f")..."
            docker compose exec -T postgres psql -U cordlyx -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" 2>/dev/null
            docker compose exec -T postgres psql -U cordlyx < "$f"
            log_ok "Restore complete from $(basename "$f")"
        else
            log_error "Invalid selection"
        fi
        break
    done
}

backup_uploads() {
    "$ROOT_DIR/backup/backup.sh" --uploads
}

backup() {
    "$ROOT_DIR/backup/backup.sh"
}

start_backend() {
    build_shared
    # Kill any existing process on port 4000 to avoid EADDRINUSE on restart
    lsof -ti :4000 | xargs kill -9 2>/dev/null || true
    sleep 0.5
    log_info "Starting backend (port 4000)..."
    cd "$ROOT_DIR/backend"
    npm run dev &
    save_pid
    cd "$ROOT_DIR"
    log_ok "Backend starting at http://localhost:4000"
}

start_worker() {
    log_info "Starting BullMQ worker..."
    cd "$ROOT_DIR/backend"
    npx tsx watch worker/src/main.ts &
    save_pid
    cd "$ROOT_DIR"
    log_ok "Worker started"
}

start_frontend() {
    log_info "Starting frontend (port 3000)..."
    cd "$ROOT_DIR/frontend"
    npm run dev &
    save_pid
    cd "$ROOT_DIR"
    log_ok "Frontend starting at http://localhost:3000"
}

run_tests() {
    log_info "Running backend tests..."
    cd "$ROOT_DIR/backend"
    npx vitest run --reporter=verbose 2>&1 | tail -30
    cd "$ROOT_DIR"
    echo ""
    log_info "Running frontend tests..."
    cd "$ROOT_DIR/frontend"
    npx vitest run --reporter=verbose 2>&1 | tail -20
    cd "$ROOT_DIR"
    echo ""
    log_ok "Tests complete"
}

run_tests_coverage() {
    log_info "Running backend tests with coverage..."
    cd "$ROOT_DIR/backend"
    npx vitest run --coverage --reporter=verbose 2>&1 | tail -40
    cd "$ROOT_DIR"
    echo ""
    log_info "Running frontend tests with coverage..."
    cd "$ROOT_DIR/frontend"
    npx vitest run --coverage --reporter=verbose 2>&1 | tail -30
    cd "$ROOT_DIR"
    echo ""
    log_ok "Coverage report complete"
}

full_stack() {
    check_port 5432 || true
    check_port 6379 || true
    check_port 4000 || true
    check_port 3000 || true
    start_infra
    build_shared
    # Only push schema on first-time setup (empty DB).
    # On restarts, data is preserved in Docker volumes — no push needed.
    # To apply schema changes manually, use option 6.
    local table_count
    table_count=$(docker compose exec -T postgres psql -U cordlyx cordlyx -tAc \
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" \
        2>/dev/null | tr -d '[:space:]')
    if [ "${table_count:-0}" -lt 5 ]; then
        log_info "Fresh database detected — pushing schema..."
        db_push
    else
        log_info "Schema already applied — skipping push (use option 6 to update schema)"
    fi
    start_backend
    start_worker
    sleep 2
    start_frontend
    echo ""
    log_info "============================================="
    log_info "  CordLyx is running!"
    log_info "  Frontend: http://localhost:3000"
    log_info "  Backend:  http://localhost:4000"
    log_info "  API docs: http://localhost:4000/api/v1"
    log_info "============================================="
    log_info "  Press Ctrl+C to stop all services"
    echo ""
    wait
}

show_menu() {
    echo ""
    echo -e "${CYAN}CordLyx Dev Launcher${NC}"
    echo "===================="
    echo "1)  Full stack (DB + API + Worker + Frontend)"
    echo "2)  Infrastructure only (PostgreSQL + Redis)"
    echo "3)  Backend only"
    echo "4)  Worker only"
    echo "5)  Frontend only"
    echo "6)  Database: push schema"
    echo "7)  Database: reset (drop + push + seed)"
    echo "8)  Database: dump"
    echo "9)  Database: restore"
    echo "10) Run tests"
    echo "11) Run tests with coverage"
    echo "12) Kill all processes"
    echo "13) Backup: full (DB + uploads)"
    echo "14) Backup: database only"
    echo "15) Backup: uploads only"
    echo "q)  Quit"
    echo ""
    read -rp "Select option [1-15/q]: " choice
    echo ""
    case "$choice" in
        1) full_stack ;;
        2) start_infra ;;
        3) start_backend ;;
        4) start_worker ;;
        5) start_frontend ;;
        6) db_push ;;
        7) db_reset ;;
        8) db_dump ;;
        9) db_restore ;;
        10) run_tests ;;
        11) run_tests_coverage ;;
        12) cleanup ;;
        13) backup ;;
        14) db_dump ;;
        15) backup_uploads ;;
        q|Q) exit 0 ;;
        *) log_error "Invalid option" && show_menu ;;
    esac
}

check_deps
check_env

if [ $# -gt 0 ]; then
    case "$1" in
        full)    full_stack ;;
        infra)   start_infra ;;
        backend) start_backend ;;
        worker)  start_worker ;;
        front)   start_frontend ;;
        db)      db_push ;;
        reset)   db_reset ;;
        dump)    db_dump ;;
        restore) db_restore ;;
        backup)  backup ;;
        backup-db) db_dump ;;
        backup-uploads) backup_uploads ;;
        test)    run_tests ;;
        report)  run_tests_coverage ;;
        *)       log_error "Unknown command: $1" && exit 1 ;;
    esac
else
    show_menu
fi
