# CordLyx

Open-source issue tracking system — a lightweight alternative to Jira / Linear. Built with NestJS, Next.js, PostgreSQL, and Redis.

## Features

| Area | End-to-end (API + UI) |
|------|----------------------|
| **Auth** | Register, login, token refresh, change password |
| **Users** | Profile page (name/avatar), account deletion |
| **Projects** | Create, list, view, soft-delete |
| **Items** | Detail page, list with cursor pagination + filters, inline editing (status/priority/assignee), board view (kanban with drag persistence), saved views |
| **Comments** | CRUD on item detail page, threaded replies, emoji reactions, @mentions |
| **Tags** | Toggle tags on item detail page, CRUD per project |
| **Quick create** | Modal with Cmd+K hotkey, project + type selector, duplicate detection |
| **Members** | List, add by search, change role, remove |
| **Project config** | CRUD types/statuses/priorities/tags via Settings tab |
| **Search** | Global command palette (`/` key) with debounced PostgreSQL full-text search |
| **Activity** | Project + item activity timeline with actor info |
| **Attachments** | Upload files (10 MB limit, MIME validation), clipboard paste, delete with inline image cleanup |
| **Relations** | Link items (blocks/depends on/relates to/duplicates/child of) |
| **Plans** | CRUD releases/milestones/campaigns/goals |
| **Roadmaps** | Interactive Gantt-chart editor with lanes, drag scheduling, dependency arrows |
| **Notifications** | Dropdown + full page, @mention and assigned triggers, mark read/all |
| **Invites** | Shareable invite links for projects (7-day expiry) |
| **Export** | Download all items as CSV |
| **Webhooks** | Outgoing HTTP callbacks on project events |
| **API Keys** | `clx_` prefixed keys for integrations |
| **Admin panel** | System-wide user/project management |
| **Dark mode** | next-themes with class strategy |
| **Keyboard shortcuts** | Cmd+K, `/`, `?`, Escape |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 22, TypeScript, NestJS 11 (SWC builder) |
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS, TipTap |
| Database | PostgreSQL 16 (PostGIS), Drizzle ORM |
| Cache / Queue | Redis 7, BullMQ |
| Auth | JWT (access 15m + refresh 7d), bcrypt |
| Real-time | Socket.IO (WebSocket) |
| Storage | Local filesystem (abstracted for S3 later) |
| Monorepo | npm workspaces |

## Quick Start (local dev)

**Prerequisites:** Node.js 22, Docker, npm.

> Two modes: **local dev** (`npm` + `dev.sh`, DB in Docker) vs **production**
> (Docker only, see [Deployment](#deployment)). They don't mix — `dev.sh`
> is dev-only and is not used on the server.

```bash
# 1. Clone and install
git clone <repo-url> && cd cordlyx
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET to a random string (32+ chars):
# openssl rand -base64 48

# 3. Full local stack (infra + schema + seed + backend + worker + frontend)
./dev.sh full

# Or use the launcher:
./dev.sh               # interactive menu
```

**Demo credentials:**
- `alice@example.com` / `password123` (admin)
- `bob@example.com` / `password123` (member)

## Project Structure

```
cordlyx/
├── packages/
│   └── shared/          # Isomorphic types, Zod schemas, constants
├── backend/
│   ├── src/
│   │   ├── modules/     # ~17 NestJS feature modules
│   │   ├── common/      # Guards, decorators, filters
│   │   ├── database/    # Drizzle schema, connection, seed
│   │   ├── queue/       # BullMQ activity queue
│   │   └── worker.ts    # Compiled-mode worker entry
│   ├── worker/          # Standalone BullMQ worker process
│   └── drizzle/         # Drizzle Kit config
├── frontend/
│   ├── src/
│   │   ├── app/         # Next.js App Router pages
│   │   ├── components/  # UI + feature components
│   │   ├── hooks/       # Custom React hooks
│   │   └── stores/      # Zustand auth store
├── e2e/                 # Playwright end-to-end tests
├── backup/              # Backup scripts + systemd/cron setup
├── nginx/               # Reverse proxy config
├── dev.sh               # Interactive launcher
├── docker-compose.yml   # PostgreSQL 16 + Redis 7 (dev)
└── docker-compose.prod.yml  # Full production stack + nginx
```

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start backend + frontend concurrently |
| `npm run build` | Build all packages (shared → backend → frontend) |
| `npm run lint` | Type-check all workspaces |
| `npm run typecheck` | Alias for lint |
| `npm test` | Run all unit/integration tests (**341 tests**) |
| `npm run test:e2e` | Run Playwright e2e tests (**16 specs**) |
| `npm run test -w backend` | Run backend tests only |
| `npm run test -w frontend` | Run frontend tests only |

Backend-only:
| Command | Description |
|---------|-------------|
| `npm run db:push -w backend` | Push Drizzle schema to dev DB |
| `npm run test:db:push -w backend` | Push schema to test DB |
| `npm run dev -w backend` | Backend in watch mode |
| `npm run start:worker -w backend` | Start BullMQ worker |

### `dev.sh` Launcher

| Option | CLI argument | Description |
|--------|-------------|-------------|
| 1 | `full` | Full stack (infra → push → seed → backend → worker → frontend) |
| 2 | `infra` | PostgreSQL + Redis only |
| 3 | `backend` | Backend only |
| 4 | `worker` | BullMQ worker only |
| 5 | `front` | Frontend only |
| 6 | `db` | Push database schema (with search_vector fix) |
| 7 | `reset` | Drop schema → push → seed |
| 8 | `dump` | pg_dump to `backups/` |
| 9 | `restore` | Restore from `backups/` (interactive) |
| 10 | `test` | Run all tests |
| 11 | `report` | Tests with coverage report |
| 12 | — | Kill all processes |
| 13-15 | — | Backup shortcuts |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgres://cordlyx:cordlyx@localhost:5432/cordlyx` | PostgreSQL connection |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection |
| `JWT_SECRET` | (required) | JWT signing key (min 32 chars) |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token TTL |
| `PORT` | `4000` | Backend server port |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000/api/v1` | Backend URL for frontend (baked at build time — prod uses `/api/v1` via build arg) |
| `POSTGRES_PASSWORD` | `cordlyx` | Prod DB password (default keeps dev/CI compat) |
| `CORS_ORIGIN` | — | Prod CORS origin (not needed for same-origin via nginx) |
| `ADMIN_EMAILS` | — | Comma-separated admin email addresses |
| `STORAGE_PROVIDER` | `local` | File storage provider |
| `STORAGE_LOCAL_PATH` | `./data/uploads` | Local upload path |

## Deployment

### Docker (recommended, production)

On the server you need only `git + Docker + .env` — no `node`/`npm`/`dev.sh`
(`dev.sh` is local-dev only; app is built inside Docker images).

```bash
git clone <repo-url> && cd cordlyx
cp .env.example .env
# Required in prod: JWT_SECRET (32+ chars), ADMIN_EMAILS
# openssl rand -base64 48
# Optional: POSTGRES_PASSWORD (strong password)

# Build and start all services
docker compose -f docker-compose.prod.yml up -d --build
```

This starts PostgreSQL, Redis, the NestJS API, the BullMQ worker, the Next.js frontend, and nginx (reverse proxy). Only nginx is published to the host (port 3005). Nginx serves as a single entry point:

```
nginx:3005
  ├── /health         → api:4000 (DB check, no auth)
  ├── /api/v1/*      → api:4000
  ├── /uploads/*     → api:4000
  ├── /socket.io/*   → api:4000 (with WebSocket upgrade)
  └── /*             → frontend:3000
```

Schema is not auto-applied — push it once on a fresh server, then create
your admin via registration (no demo seed in prod):

```bash
# from the repo root, with DATABASE_URL pointing at the server DB:
npm run build -w packages/shared && npm run build -w backend
npx --prefix backend drizzle-kit push --force
docker compose -f docker-compose.prod.yml exec -T postgres psql -U cordlyx cordlyx -c "
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_items_search ON items USING gin(search_vector);
"
```

Verify:

```bash
docker compose -f docker-compose.prod.yml ps   # all running/healthy
docker logs cordlyx-api --tail 20              # no JWT/Zod errors
curl http://<SERVER_IP>:3005/health            # DB check
curl http://<SERVER_IP>:3005/                  # frontend HTML
```

Firewall: prod compose publishes only `3005:80` (DB/Redis/API ports stay
inside the Docker network). On the host allow only `22` (your SSH) + `3005`,
e.g. `ufw default deny incoming && ufw allow 22,3005/tcp`.
Note: Docker publishes ports via iptables, bypassing UFW — so don't add
`ports:` for DB/Redis to the prod file. For DB admin use
`ssh -L 5432:localhost:5432 user@server` instead of exposing ports.

Do NOT open `http://<host>:5432` or `:6379` in a browser — those are raw
TCP (Postgres wire protocol / RESP), not HTTP. The browser probe logs
`invalid length of startup packet` (Postgres) and `Possible SECURITY ATTACK
... Host:` (Redis) and is harmless; check health with `pg_isready` /
`redis-cli ping` instead.

### Auto-deploy (GitHub Actions)

Branches: `feature/*` → PR → `dev` (no CI) → PR → `main` (CI + auto-deploy).
Direct pushes to `main` are blocked by branch protection (PR required,
no required status checks — CI runs only post-merge).

CI (`lint-and-test`) runs **once per release**, on push to `main` only
(docs-only changes are ignored). Green run triggers `Deploy`, which SSHes
into the VPS and runs: `git pull` → DB backup → `compose up -d --build` →
`pg_isready` → health retries on `http://localhost:3005/health`. Red run =
no deploy. Rollback: Actions → Deploy → Run workflow → `ref` = previous SHA.

Run `npm test` locally before opening a PR to `main` — it replaces the
missing PR checks.

Required GitHub Environment `production` secrets: `SSH_HOST`, `SSH_USER`,
`SSH_KEY` (+ optional `SSH_PORT` default `22`, `DEPLOY_PATH` default
`~/cordlyx`). Server-side `.env` (`JWT_SECRET 32+`, `ADMIN_EMAILS`,
`POSTGRES_PASSWORD`) is never stored in the repo.

### Manual

```bash
# 1. Build all packages
npm run build

# 2. Start
node backend/dist/src/main           # NestJS API
node backend/dist/src/worker         # BullMQ worker
npx next start -p 3000               # Next.js frontend (from frontend/)
```

## Tests

```bash
# All tests
npm test                    # 341 tests (48 files)

# Per workspace
npm run test -w backend     # 268 tests (39 files)
npm run test -w frontend    # 39 tests (8 files)
npm run test -w packages/shared  # 34 tests (1 file)

# End-to-end (Playwright)
npx playwright test         # 16 specs (auth, projects, items, board, plans, roadmaps, ...)

# With coverage
./dev.sh report
```

### Coverage by area

| Area | Tests |
|------|-------|
| Shared Zod schemas | 34 |
| Auth (service + controller) | 18 |
| Users (service + controller) | 10 |
| Projects (service + controller) | 16 |
| Project members (service + controller) | 13 |
| Project config (service + controller) | 23 |
| Items (service + controller) | 22 |
| Board controller | 5 |
| Quick-create controller | 3 |
| Comments (service + controller, reactions) | 15 |
| Tags (service + controller) | 12 |
| Relations (service + controller) | 13 |
| Attachments (service + controller) | 12 |
| Activities (service + controller) | 14 |
| Search (service + controller) | 14 |
| Plans (service + controller) | 14 |
| Roadmaps (service + controller) | 15 |
| Guards | 14 |
| Events gateway | 8 |
| Activity queue (service + listener) | 10 |
| ApiKeys (service + controller) | 8 |
| Notifications (controller + listener) | 10 |
| Auth store (frontend) | 6 |
| API client (frontend) | 4 |
| useSocket hook (frontend) | 8 |
| useSavedViews hook (frontend) | 6 |
| ShortcutsModal (frontend) | 4 |
| SearchModal (frontend) | 3 |
| CreateProjectModal (frontend) | 4 |
| QuickCreateModal (frontend) | 4 |

### E2E specs

| Spec | Tests |
|------|-------|
| `auth.spec.ts` | Login, logout, invalid credentials |
| `registration.spec.ts` | User registration |
| `profile.spec.ts` | User profile |
| `project-flow.spec.ts` | Project CRUD flow |
| `permissions.spec.ts` | Role-based access |
| `item-lifecycle.spec.ts` | Item create/update/delete |
| `item-edit.spec.ts` | Inline editing on list |
| `item-detail.spec.ts` | Detail page fields |
| `board-drag.spec.ts` | Drag-and-drop + create on board |
| `quick-create-board.spec.ts` | Quick-create modal |
| `search.spec.ts` | Search functionality |
| `attachments.spec.ts` | File upload/paste/delete |
| `roadmaps.spec.ts` | Roadmap CRUD |
| `plans.spec.ts` | Plan CRUD |
| `shortcuts.spec.ts` | Keyboard shortcuts |
| `dark-mode.spec.ts` | Theme toggle |

## CI/CD

The project includes a GitHub Actions workflow (`.github/workflows/ci.yml`) that runs on push/PR to main/master:

1. Start PostgreSQL + Redis (GitHub Actions services)
2. `npm ci` — install dependencies
3. `npm run build -w packages/shared` — build shared package
4. `npm run lint` — TypeScript type-check
5. Push schema to test DB
6. `npm test` — run all unit/integration tests
7. `npm run build` — build all workspaces

## License

MIT
