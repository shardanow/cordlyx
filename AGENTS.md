# CordLyx — Agent Guide

## Quick start

```bash
cp .env.example .env            # then set JWT_SECRET
docker compose up -d            # PostgreSQL + Redis
npm run build -w packages/shared # must build shared first
npm run dev                     # backend (4000) + frontend (3000)
```

Or use `./dev.sh full` for infra → build → seed → backend → worker → frontend.

**Demo creds:** `alice@example.com` / `password123` (admin)

## Dev launcher (`./dev.sh`)

| Arg | Action |
|-----|--------|
| `full` | Full stack (skips schema push on restart if tables exist) |
| `infra` | PostgreSQL + Redis only |
| `backend` / `front` / `worker` | Single service |
| `db` | Push schema (Drizzle + manual search_vector fix) |
| `reset` | Drop → push → seed |
| `dump` / `restore` | pg_dump to `backups/` |

## Build order (must sequence)

`npm run build -w packages/shared` → `npm run build -w backend` → `npm run build -w frontend`

## Test commands

```bash
npm test                         # all 3 workspaces
npm run test -w backend          # vitest (node env, serial)
npm run test -w frontend         # vitest (happy-dom env)
npm run test -w packages/shared  # vitest
npx playwright test              # e2e, needs full stack running
./dev.sh report                  # all tests + coverage
```

Backend vitest config: `fileParallelism: false`, 15s timeout, setup at `src/test/setup.ts`.

**Test database:** Backend tests use a **separate** database `cordlyx_test` (defined in `backend/.env.test`) to avoid wiping dev data. Tests `TRUNCATE users CASCADE` — would destroy all data in `cordlyx`. The test DB is auto-created by `./dev.sh start_infra` (or `./dev.sh full`). To push schema to test DB manually: `npm run test:db:push -w backend` (then re-apply search_vector fix).

## Lint / typecheck

```bash
npm run lint       # tsc --noEmit on all workspaces
npm run typecheck  # alias
```

Order: `lint` → `test` → `build` (no formatter configured).

## Architecture

- **Monorepo** — npm workspaces: `packages/shared` (`@cordlyx/shared`), `backend` (`@cordlyx/backend`), `frontend` (`@cordlyx/frontend`)
- **Backend** — NestJS 11, SWC builder (`nest-cli.json`), decorators enabled, Pino logger, Helmet (CSP disabled)
- **Frontend** — Next.js 15 App Router, `output: 'standalone'`, `transpilePackages: ['@cordlyx/shared']`, Tailwind CSS (dark mode via `class`), Zustand + TanStack Query
- **Shared** — Zod schemas, built as CJS + ESM dual output (`tsc -p tsconfig.cjs.json && tsc`)
- **Worker** — separate BullMQ process (`worker/src/main.ts`), also available in `src/worker.ts` for compiled mode

## DB quirks

- Drizzle Kit reads from compiled output: `drizzle.config.ts` has `schema: './dist/src/database/schema/index.js'`
- `drizzle-kit push --force` is used (avoids confirmation prompt)
- After push, `dev.sh` runs a manual SQL step to restore `search_vector` generated column + GIN index (Drizzle cannot represent `GENERATED ALWAYS AS ... STORED` columns)
- Tests use a separate DB (`cordlyx_test`); push schema there with `npm run test:db:push -w backend` (then re-apply search_vector fix)
- Seed runs only from compiled JS; `dev.sh` patches `.ts` → `.js` in require paths in dist
- UUIDv7 PKs everywhere, soft delete (`deleted_at`) on items/comments/attachments
- JWT access token (15m) + refresh token (7d, httpOnly cookie rotation)

## Events & queues

- Controllers emit domain events via `EventEmitter2` (`@nestjs/event-emitter`)
- `ActivityEventListener` enqueues BullMQ `activity` queue jobs
- Separate `worker` process (or `src/worker.ts` in compiled mode) consumes and writes to `activities` table
- `EventsGateway` broadcasts WebSocket events to project rooms (Socket.IO)

## Caching (Redis)

- Membership roles cached 30 min, invalidated on member changes
- Project config (types/statuses/priorities) cached 1 h, invalidated on config CRUD
- Redis also used by BullMQ queue storage

## API

- Global prefix: `api/v1`, health endpoint excluded at `/health`
- Standard envelope: `{ data, meta? }` success, `{ statusCode, error, message, requestId, timestamp }` error
- Guards chain: `JwtAuthGuard` → `ProjectMembershipGuard` → `ProjectRoleGuard`
- Cursor pagination: `base64(created_at + '|' + id)` in `meta.cursor`

## Storage

- Abstracted via `StorageProvider` interface
- Default: `LocalStorageProvider` writing to `./data/uploads/`
- S3Provider interface ready, not implemented
- Static uploads served at `/uploads` prefix by NestJS
- File upload limits: 10 MB max, MIME + magic byte validation

## Backups

- **`backup/backup.sh`** — main backup script; handles dev (local dir) and Docker (volume tar pipe); gracefully skips if containers are down
  - `./backup/backup.sh` — full backup (DB + uploads + cleanup)
  - `./backup/backup.sh --db` / `--uploads` / `--cleanup`
  - **Bash only, no rsync/alpine needed** — `pg_dump` via `docker compose exec`, uploads via `cp -a` (dev) or `tar` pipe from container (prod)
- **`backup/setup-cron.sh`** — one-command scheduler installer
  - `./backup/setup-cron.sh` — auto-detect: installs systemd timer (supports catch-up on boot via `Persistent=true`) or falls back to cron
  - `./backup/setup-cron.sh --systemd` — force systemd user timer
  - `./backup/setup-cron.sh --cron` — force cron (legacy)
  - `./backup/setup-cron.sh --uninstall` — removes both systemd and cron entries
  - Detects project path automatically; works on dev machine and production server
- **`dev.sh`** menu options 13-15 delegate to `backup/backup.sh`
- **Config via env:** `BACKUP_DIR` (default `backups/`), `RETENTION_DAYS` (default 14), `POSTGRES_CONTAINER` (default `cordlyx-postgres`), `API_CONTAINER` (default `cordlyx-api`)

## Key paths

- API client: `frontend/src/lib/api-client.ts` (fetch wrapper with token injection)
- Auth store: `frontend/src/stores/` (Zustand)
- Middleware: `frontend/src/middleware.ts` (Next.js auth middleware)
