# CordLyx — Architecture

> Issue tracking system — lightweight Jira/Linear alternative.
> Stack: NestJS 11 + Drizzle ORM + PostgreSQL 16 + Redis 7 + BullMQ + Next.js 15 + React 19 + Tailwind CSS

---

## 1. Monorepo

```
cordlyx/
├── packages/
│   └── shared/                # Zod schemas, TypeScript types, constants
│       └── src/
│           ├── schemas/       # 35 Zod schemas (register, login, item, comment, etc.)
│           ├── constants/     # Roles, relation types, status categories, plan types
│           └── types/         # User, Project, Item, Comment, Attachment, etc.
├── backend/
│   ├── src/
│   │   ├── modules/          # 19 feature modules
│   │   ├── common/           # Guards (Jwt, Membership, Role, Admin), decorators, filters
│   │   ├── database/         # Drizzle schema (21 tables), client, seed
│   │   ├── queue/            # BullMQ activity queue + event listener
│   │   ├── storage/          # StorageProvider interface + LocalStorageProvider
│   │   ├── cache/            # Redis caching service
│   │   ├── worker.ts         # Compiled-mode BullMQ worker entry
│   │   └── main.ts           # App bootstrap + Express upload route
│   ├── worker/               # Standalone BullMQ worker Docker image
│   └── drizzle.config.ts
├── frontend/
│   ├── src/
│   │   ├── app/              # Next.js App Router (16+ routes)
│   │   │   ├── (auth)/       # login, register
│   │   │   └── (dashboard)/  # projects, board, items, plans, roadmaps, activity, members, settings, admin, notifications, invite
│   │   ├── components/       # UI primitives + feature components
│   │   │   ├── ui/           # Button, Input, Select, Avatar, Badge, Card, Skeleton
│   │   │   └── features/     # AvatarCircle, TypeIcon
│   │   ├── hooks/            # useSocket, useSavedViews, useEscToClose
│   │   ├── stores/           # Zustand auth store
│   │   └── middleware.ts     # Auth middleware (refresh token check)
│   ├── e2e/                  # Playwright tests (16 specs, ~62 tests)
│   └── next.config.ts
├── nginx/                    # Reverse proxy config (prod)
├── backup/                   # Backup scripts + systemd timer / cron setup
├── .github/workflows/        # CI pipeline (lint → test → build)
├── dev.sh                    # Interactive launcher
├── docker-compose.yml        # PostgreSQL + Redis (dev)
└── docker-compose.prod.yml   # PostgreSQL + Redis + API + Worker + Frontend + nginx
```

---

## 2. Modules (Backend)

| Module | Responsibility | Key Files |
|--------|---------------|-----------|
| **Auth** | Register, login, refresh, change password | `auth.controller.ts`, `auth.service.ts`, `jwt.strategy.ts`, `local.strategy.ts` |
| **Users** | Profile CRUD, search, delete account | `users.controller.ts`, `users.service.ts` |
| **Projects** | Project CRUD, soft-delete | `projects.controller.ts`, `projects.service.ts` |
| **Project Members** | RBAC: add/update/remove members | `project-members.controller.ts`, `project-members.service.ts` |
| **Project Config** | Item types/statuses/priorities CRUD | `project-config.controller.ts`, `project-config.service.ts` |
| **Items** | Item CRUD, pagination, filters, board move, export, clone | `items.controller.ts`, `items.service.ts` |
| **Board** | Board view (items grouped by status), move item | `board.controller.ts` |
| **Quick Create** | Minimal item creation from anywhere | `quick-create.controller.ts` |
| **Comments** | Comment CRUD, threaded replies, soft-delete | `comments.controller.ts`, `comments.service.ts` |
| **Tags** | Tag CRUD | `tags.controller.ts`, `tags.service.ts` |
| **Attachments** | File upload (MIME + size validation), delete, image ref cleanup | `attachments.controller.ts`, `attachments.service.ts` |
| **Relations** | Link items (6 relation types) | `relations.controller.ts`, `relations.service.ts` |
| **Votes** | Toggle upvote on items | embedded in items module as `votes.service.ts` |
| **Reactions** | Emoji reactions on comments | embedded in comments module |
| **Plans** | Plan CRUD (releases/milestones/campaigns/goals) | `plans.controller.ts`, `plans.service.ts` |
| **Roadmaps** | Roadmap CRUD, lane CRUD, schedule/unschedule items | `roadmaps.controller.ts`, `roadmaps.service.ts` |
| **Activities** | Read activity log (project + item scope, cursor paginated) | `activities.controller.ts`, `activities.service.ts` |
| **Search** | Full-text search across items (tsvector + GIN) | `search.controller.ts`, `search.service.ts` |
| **Notifications** | List, unread count, mark read/all-read | `notifications.controller.ts`, `notifications.service.ts` |
| **API Keys** | Create, list, revoke (SHA-256 hashed) | `api-keys.controller.ts`, `api-keys.service.ts` |
| **Events** | WebSocket gateway (Socket.IO) — broadcast to project rooms | `events.gateway.ts` |
| **Admin** | System-wide user/project management | `admin.controller.ts`, `admin.service.ts`, `admin.guard.ts` |
| **Webhooks** | Outbound HTTP callbacks on project events | `webhooks.controller.ts`, `webhooks.service.ts` |
| **Invites** | Shareable invite link generation + acceptance | embedded in projects module as `invites.service.ts` |

---

## 3. Database Schema (21 tables)

| Table | Description | Key Columns |
|-------|-------------|-------------|
| `users` | Core user accounts | `id (UUIDv7)`, `email`, `password_hash`, `name`, `is_active`, `created_at`, `updated_at` |
| `projects` | Projects | `id`, `name`, `slug` (unique), `owner_id`, `is_archived`, `settings (jsonb)` |
| `project_members` | User-project membership with role | `project_id`, `user_id`, `role (admin/member/viewer)`, UNIQUE(project_id, user_id) |
| `item_types` | Per-project item types | `name`, `color`, `icon`, `sort_order`, UNIQUE(project_id, name) |
| `item_statuses` | Per-project statuses | `name`, `color`, `category (inbox/backlog/todo/active/done/cancelled)`, `sort_order` |
| `item_priorities` | Per-project priorities | `name`, `color`, `icon`, `sort_order` |
| `items` | Core items | `sequence_num`, `title`, `description`, `type_id`, `status_id`, `priority_id`, `assignee_id`, `reporter_id`, `parent_id`, `plan_id`, `due_date`, `estimated_hours`, `sort_order (float8)`, `search_vector (tsvector, GENERATED)`, `deleted_at` (soft delete) |
| `issue_sequences` | Auto-increment counter per project | `project_id` (PK), `last_value` |
| `tags` | Per-project tags | `name`, `color`, UNIQUE(project_id, name) |
| `item_tags` | M:N items <-> tags | `item_id`, `tag_id` (composite PK) |
| `comments` | Comments on items | `body`, `author_id`, `parent_id` (threading), `deleted_at` |
| `comment_reactions` | Emoji reactions on comments | `reaction`, `user_id`, `comment_id` |
| `attachments` | File uploads | `filename`, `mime_type`, `size_bytes`, `storage_path`, `uploader_id`, `item_id`, `deleted_at` |
| `item_relations` | Links between items | `source_item_id`, `target_item_id`, `relation_type (blocks/depends_on/relates_to/duplicates/child_of)`, UNIQUE(source, target, type) |
| `item_votes` | Upvotes on items | `item_id`, `user_id` |
| `plans` | Release/milestone grouping | `name`, `type (release/milestone/campaign/goal/custom)`, `status`, `color`, `sort_order` |
| `roadmaps` | Timeline schedules | `name`, `start_date`, `end_date`, `color`, `sort_order` |
| `roadmap_lanes` | Swimlanes in roadmaps | `name`, `icon`, `color`, `sort_order`, `roadmap_id` |
| `roadmap_items` | Items scheduled on roadmaps | `roadmap_id`, `item_id`, `lane_id`, `start_date`, `due_date`, UNIQUE(roadmap_id, item_id) |
| `activities` | Audit log (async via BullMQ) | `project_id`, `actor_id`, `item_id`, `action`, `field_name`, `old_value (jsonb)`, `new_value (jsonb)`, `created_at` |
| `notifications` | Per-user notifications | `type`, `user_id`, `project_id`, `item_id`, `data (jsonb)`, `read_at` |
| `api_keys` | Hashed API keys | `key_hash`, `key_prefix`, `name`, `user_id`, `project_id` (optional scope), `expires_at`, `last_used_at` |
| `invites` | Project invite tokens | `project_id`, `token` (unique), `role`, `expires_at`, `used_at`, `created_by_id` |
| `webhooks` | Outbound webhook config | `project_id`, `url`, `events (jsonb[])`, `is_active` |

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| UUIDv7 for all PKs | Time-ordered, distributed-safe, no sequence contention |
| `search_vector tsvector` on items | Full-text search via GIN index, zero external deps |
| `sort_order float8` | Fractional indexing for O(1) reordering |
| Sequence per project | Human-readable issue numbers (PROJ-42) without MAX(id) lock |
| Soft delete (`deleted_at`) on items/comments/attachments | Recovery + audit trail |
| JSONB for activity old/new values | Flexible audit without migrations |

---

## 4. Guards Chain

```
ThrottlerGuard (global, 60 req/min, 10 req/min on auth)
  └─ JwtAuthGuard (validates Bearer JWT, sets request.user)
       └─ ApiKeyOrJwtAuthGuard (accepts JWT or X-API-Key header)
       └─ AdminGuard (checks email against ADMIN_EMAILS env)
       └─ ProjectMembershipGuard (resolves :projectSlug, checks membership, caches 30 min)
            └─ ProjectRoleGuard (checks @MinimumRole('viewer'/'member'/'admin'))
```

Role hierarchy: viewer(1) < member(2) < admin(3)

---

## 5. API Endpoints

### Auth
```
POST   /api/v1/auth/register           # Create account (throttled: 10/min)
POST   /api/v1/auth/login              # Email + password → { accessToken, refreshToken } (10/min)
POST   /api/v1/auth/refresh            # Rotate refresh token (unthrottled)
PATCH  /api/v1/auth/change-password    # Change current password (JWT)
```

### Users
```
GET    /api/v1/users/me                # Current user profile
PATCH  /api/v1/users/me                # Update profile (name, avatarUrl)
DELETE /api/v1/users/me                # Delete account (deactivate)
GET    /api/v1/users/search?q=         # Search users
```

### Projects
```
POST   /api/v1/projects                # Create
GET    /api/v1/projects                # List user's projects
GET    /api/v1/projects/:slug          # Get by slug
PATCH  /api/v1/projects/:slug          # Update (admin)
DELETE /api/v1/projects/:slug          # Soft-delete (admin)
POST   /api/v1/projects/:slug/invites  # Create invite link (admin)
GET    /api/v1/invites/:token          # Get invite info (JWT)
POST   /api/v1/invites/:token/accept   # Accept invite → join project (JWT)
```

### Project Members
```
GET    /api/v1/projects/:slug/members           # List
POST   /api/v1/projects/:slug/members           # Add by userId (admin)
PATCH  /api/v1/projects/:slug/members/:id       # Change role (admin)
DELETE /api/v1/projects/:slug/members/:id       # Remove (admin)
```

### Project Config
```
GET    /api/v1/projects/:slug/types             # Item types (all members)
POST   /api/v1/projects/:slug/types             # Create (admin)
PATCH  /api/v1/projects/:slug/types/:id         # Update (admin)
DELETE /api/v1/projects/:slug/types/:id         # Delete (admin)

GET    /api/v1/projects/:slug/statuses          # Statuses
POST   /api/v1/projects/:slug/statuses          # Create (admin)
PATCH  /api/v1/projects/:slug/statuses/:id      # Update (admin)
DELETE /api/v1/projects/:slug/statuses/:id      # Delete (admin)

GET    /api/v1/projects/:slug/priorities        # Priorities
POST   /api/v1/projects/:slug/priorities        # Create (admin)
PATCH  /api/v1/projects/:slug/priorities/:id    # Update (admin)
DELETE /api/v1/projects/:slug/priorities/:id    # Delete (admin)
```

### Items
```
GET    /api/v1/projects/:slug/items             # List (cursor pagination, filters: type/status/priority/assignee/reporter/tag/plan/search/sort)
GET    /api/v1/projects/:slug/items/export      # Export all as CSV (query: ?format=csv|json|jsonl)
POST   /api/v1/projects/:slug/items             # Create
GET    /api/v1/projects/:slug/items/:seq        # Get by sequence number
POST   /api/v1/projects/:slug/items/check-duplicates  # Check duplicate titles
POST   /api/v1/projects/:slug/items/:id/clone   # Clone item
PATCH  /api/v1/projects/:slug/items/:id         # Update
DELETE /api/v1/projects/:slug/items/:id         # Soft-delete (cascades: deletes attachments)
POST   /api/v1/projects/:slug/items/:id/vote    # Toggle vote
GET    /api/v1/projects/:slug/items/:id/votes   # Get votes
```

### Board
```
GET    /api/v1/projects/:slug/board             # Items grouped by status column
PATCH  /api/v1/projects/:slug/board/:itemId     # Move item between columns
```

### Quick Create
```
POST   /api/v1/quick-create                     # Minimal: title + type → full item
```

### Tags
```
GET    /api/v1/projects/:slug/tags
POST   /api/v1/projects/:slug/tags
PATCH  /api/v1/projects/:slug/tags/:id
DELETE /api/v1/projects/:slug/tags/:id
```

### Comments
```
GET    /api/v1/projects/:slug/items/:itemId/comments       # List (threaded with reactions)
POST   /api/v1/projects/:slug/items/:itemId/comments       # Create
PATCH  /api/v1/projects/:slug/items/:itemId/comments/:id   # Update
DELETE /api/v1/projects/:slug/items/:itemId/comments/:id   # Soft-delete
```

### Reactions
```
POST   /api/v1/projects/:slug/items/:itemId/comments/:commentId/reactions      # Add emoji
DELETE /api/v1/projects/:slug/items/:itemId/comments/:commentId/reactions/:reaction  # Remove
```

### Attachments
```
GET    /api/v1/projects/:slug/items/:itemId/attachments     # List
POST   /api/v1/projects/:slug/items/:itemId/attachments     # Upload (multipart, 10MB limit)
DELETE /api/v1/projects/:slug/items/:itemId/attachments/:id # Delete (also replaces <img> refs)
```

### Relations
```
GET    /api/v1/projects/:slug/items/:itemId/relations
POST   /api/v1/projects/:slug/items/:itemId/relations
DELETE /api/v1/projects/:slug/items/:itemId/relations/:id
```

### Plans
```
GET    /api/v1/projects/:slug/plans
POST   /api/v1/projects/:slug/plans
PATCH  /api/v1/projects/:slug/plans/:id
DELETE /api/v1/projects/:slug/plans/:id
```

### Roadmaps
```
GET    /api/v1/projects/:slug/roadmaps                     # List (filter: sort, search)
GET    /api/v1/projects/:slug/roadmaps/:id                 # Get by ID
GET    /api/v1/projects/:slug/roadmaps/:id/items           # Get with lanes + unscheduled items
GET    /api/v1/projects/:slug/roadmaps/:id/relations       # Relations between scheduled items
POST   /api/v1/projects/:slug/roadmaps                    # Create
PATCH  /api/v1/projects/:slug/roadmaps/:id                 # Update
DELETE /api/v1/projects/:slug/roadmaps/:id                 # Delete
POST   /api/v1/projects/:slug/roadmaps/:id/lanes           # Create lane
PATCH  /api/v1/projects/:slug/roadmaps/:id/lanes/:laneId   # Update lane
DELETE /api/v1/projects/:slug/roadmaps/:id/lanes/:laneId   # Delete lane
POST   /api/v1/projects/:slug/roadmaps/:id/schedule        # Schedule items
DELETE /api/v1/projects/:slug/roadmaps/:id/items/:itemId   # Unschedule item
PATCH  /api/v1/projects/:slug/roadmaps/:id/items/:itemId   # Update item dates/lane
```

### Activity
```
GET    /api/v1/projects/:slug/activity                     # Project timeline (cursor pagination)
GET    /api/v1/projects/:slug/items/:itemId/activity       # Per-item timeline
```

### Search
```
GET    /api/v1/search?q=&projectId=&cursor=&limit=         # Full-text search across items
```

### Notifications
```
GET    /api/v1/notifications                               # List all (cursor pagination)
GET    /api/v1/notifications/unread                        # Unread only
GET    /api/v1/notifications/unread/count                  # Unread count
PATCH  /api/v1/notifications/:id/read                      # Mark as read
PATCH  /api/v1/notifications/read-all                      # Mark all as read
```

### API Keys
```
GET    /api/v1/api-keys                                    # List
POST   /api/v1/api-keys                                    # Create
DELETE /api/v1/api-keys/:id                                # Revoke
```

### Admin
```
GET    /api/v1/admin/check                                 # Check if current user is admin (JWT only)
GET    /api/v1/admin/users                                 # List all users
GET    /api/v1/admin/projects                              # List all projects
PATCH  /api/v1/admin/users/:id/deactivate                  # Deactivate user
```

### Webhooks
```
GET    /api/v1/projects/:slug/webhooks                     # List (admin)
POST   /api/v1/projects/:slug/webhooks                     # Create (admin)
PATCH  /api/v1/projects/:slug/webhooks/:id                 # Update (admin)
DELETE /api/v1/projects/:slug/webhooks/:id                 # Delete (admin)
```

### Health
```
GET    /health                                             # DB connectivity check (no API prefix)
```

### Standard Response Envelope

```typescript
// Success
{ data: T, meta?: { cursor: string | null, hasMore: boolean, limit: number } }

// Error
{ statusCode: number, error: string, message: string, details?: { field: string, message: string }[], requestId: string, timestamp: string }
```

Cursor format: `base64(created_at + '|' + id)`

---

## 6. WebSocket Events (Socket.IO)

### Client-to-server
| Event | Payload | Action |
|-------|---------|--------|
| `join` | `{ projectId, userId }` | Join project room + user room |
| `leave` | `{ projectId }` | Leave project room |

### Server-to-client (broadcast to project room)
| Event | Trigger | Payload |
|-------|---------|---------|
| `item:created` | `item.created` | `{ projectId, item, actorId }` |
| `item:updated` | `item.updated` | `{ projectId, item, fieldName, oldValue, newValue, actorId }` |
| `item:assigned` | `item.assigned` | `{ projectId, item, oldAssigneeId, actorId }` |
| `item:deleted` | `item.deleted` | `{ projectId, itemId, title, actorId }` |
| `comment:created` | `comment.created` | `{ projectId, itemId, comment, actorId }` |
| `comment:updated` | `comment.updated` | `{ projectId, itemId, commentId, actorId }` |
| `comment:deleted` | `comment.deleted` | `{ projectId, itemId, commentId, actorId }` |

### User-specific (to `user:{userId}` room)
| Event | Trigger | Payload |
|-------|---------|---------|
| `notification:created` | Mentions, assignment, reactions | Full notification object |

---

## 7. Queues (BullMQ)

| Queue | Jobs | Processor | Consumer |
|-------|------|-----------|----------|
| `activity` | `write-activity` | Writes row to `activities` table | `worker/src/main.ts` or `src/worker.ts` |

### Event wiring
- Controllers emit domain events via `EventEmitter2` (wildcard + delimiter `.`)
- `ActivityEventListener` (`@OnEvent`) enqueues `write-activity` jobs
- `EventsGateway` (`@OnEvent`) broadcasts WebSocket events to project rooms
- Worker process consumes jobs and inserts into `activities` table

---

## 8. Caching (Redis)

| Key Pattern | TTL | Invalidation |
|---|---|---|
| `membership:{slug}:{userId}` → `{ projectId, role }` | 30 min | On member add/update/remove |
| `config:types:{projectId}` | 1 h | On type CRUD |
| `config:statuses:{projectId}` | 1 h | On status CRUD |
| `config:priorities:{projectId}` | 1 h | On priority CRUD |

Redis also used by BullMQ for queue storage.

---

## 9. Storage

```typescript
interface StorageProvider {
  upload(stream: Readable, options: UploadOptions): Promise<UploadResult>;
  download(path: string): Promise<Readable>;
  delete(path: string): Promise<void>;
  getUrl(path: string): string;
}
```

- **LocalStorageProvider** (default) — writes to `./data/uploads/` (dev) or `/app/data/uploads/` (Docker)
- S3 interface ready, implementation not yet done
- Missing files return placeholder SVG ("Image deleted / file was removed")

---

## 10. Frontend Pages (App Router)

| Route | Page Component | Features |
|-------|---------------|----------|
| `/login` | LoginPage | Email/password form, error display, loading spinner |
| `/register` | RegisterPage | Username, display name, email, password |
| `/projects` | ProjectsPage | List, create/edit/delete modals, skeleton loading, empty state |
| `/profile` | ProfilePage | Edit name/avatar, change password, delete account, API keys |
| `/notifications` | NotificationsPage | Full list, filter all/unread, mark read, mark all read |
| `/admin` | AdminPage | Users list + projects list (admin only) |
| `/invite/:token` | InvitePage | Accept project invitation |
| `/projects/:slug` | ProjectItemsPage | Item list with search, filters, sort, saved views, inline edit, cursor pagination |
| `/projects/:slug/board` | BoardPage | Kanban with drag-and-drop (dnd-kit), column filter, DragOverlay |
| `/projects/:slug/items/:seq` | ItemDetailPage | Full item detail, rich editor, comments, attachments, relations, votes, activity |
| `/projects/:slug/plans` | PlansPage | List, create/edit/delete plans |
| `/projects/:slug/roadmaps` | RoadmapsPage | List, create/edit/delete roadmaps |
| `/projects/:slug/roadmaps/:id` | RoadmapEditorPage | Interactive Gantt timeline with lanes, drag scheduling, dependency arrows |
| `/projects/:slug/activity` | ActivityPage | Activity timeline with filters, cursor pagination |
| `/projects/:slug/members` | MembersPage | List, search/add, change role, remove, invite link generation |
| `/projects/:slug/settings` | SettingsPage | Project details, types/statuses/priorities/tags CRUD, webhooks |

### State Management

| Layer | Tool | Scope |
|-------|------|-------|
| Server state | TanStack Query v5 | All API data (30s stale time) |
| UI state | Zustand | Auth (user, tokens, login/logout) |
| Local persistence | localStorage | Sidebar open state, saved views, board column visibility |
| Real-time | Socket.IO (useSocket hook) | Auto-invalidates queries on events |
| Forms | react-hook-form + Zod | Form validation with shared schemas |
| Routing | Next.js middleware | Refresh token check → redirect to /login |

### Key Components

| Component | Purpose |
|-----------|---------|
| `RichEditor` | TipTap editor (bold/italic/strike/code, headings, lists, tables, images, @mentions, emoji) |
| `QuickCreateModal` | Cmd+K command menu for item creation with project selector, type, duplicate check |
| `SearchModal` | `/` global search with keyboard navigation |
| `ShortcutsModal` | `?` keyboard shortcuts reference |
| `NotificationsButton` | Bell icon with dropdown, unread badge (30s polling), mark read/all |
| `CreateProjectModal` | Create/edit project form with auto slug |
| `CreatePlanModal` | Create/edit plan with type, status, color presets |

---

## 11. Security

| Measure | Implementation |
|---------|---------------|
| Password hashing | bcrypt, cost factor 12 |
| JWT access token | 15 min, signed with HS256 |
| JWT refresh token | 7 days, rotation, localStorage + httpOnly cookie |
| Rate limiting | Auth endpoints: 10 req/min, API: 60 req/min per IP |
| RBAC | JwtGuard → ProjectMembershipGuard → ProjectRoleGuard (viewer/member/admin) |
| Admin access | AdminGuard checks ADMIN_EMAILS env variable |
| Input validation | Zod schemas (shared with frontend) |
| SQL injection | Drizzle parameterized queries |
| XSS | Next.js auto-escapes, Helmet (CSP disabled) |
| File upload | Max 10 MB, MIME type + magic bytes validation |
| Security headers | Helmet |

---

## 12. DevOps

### Docker

| Service | Container | Dockerfile | Port (prod) |
|---------|-----------|------------|-------------|
| PostgreSQL | `cordlyx-postgres` | `postgis/postgis:16-3.4` | — |
| Redis | `cordlyx-redis` | `redis:7-alpine` | — |
| API | `cordlyx-api` | `backend/Dockerfile` (node:22-alpine) | — |
| Worker | `cordlyx-worker` | `backend/worker/Dockerfile` (node:22-alpine) | — |
| Frontend | `cordlyx-frontend` | `frontend/Dockerfile` (node:22-alpine, standalone) | — |
| nginx | `cordlyx-nginx` | `nginx:alpine` | `80:80` |

### CI/CD (GitHub Actions)

`.github/workflows/ci.yml` — runs on push/PR to main/master:
1. Spin up PostgreSQL + Redis (GitHub Actions services)
2. `npm ci`
3. `npm run build -w packages/shared`
4. `npm run lint`
5. Push schema to test DB
6. `npm test` (341 unit/integration tests)
7. `npm run build`

### Backups

`backup/backup.sh` — full DB + uploads backup with 14-day retention. Scheduled via systemd timer (`Persistent=true`) or cron fallback (see `backup/setup-cron.sh`).

---

## 13. Test Coverage

| Workspace | Files | Tests | Approach |
|-----------|-------|-------|----------|
| `packages/shared` | 1 | 34 | Zod schema validation (pure unit) |
| `backend` | 39 | 268 | Integration (real DB, TRUNCATE per suite) + controller unit (mocked service) |
| `frontend` | 8 | 39 | Unit (mocked API/Socket) + component (React Testing Library) |
| `e2e` | 16 | ~62 | Playwright (full stack, seed data) |
| **Total** | **64** | **~403** | |

Backend tests use a separate `cordlyx_test` database (defined in `backend/.env.test`). Run `npm run test:db:push -w backend` to sync schema to test DB.

---

## 14. Implementation Status

### Implemented ✅

1. Monorepo scaffold — workspaces, shared package, configs
2. Database — 21 tables, Drizzle schema, seed data
3. Auth — register, login, JWT, refresh, change password
4. Users — profile CRUD, search, account deletion
5. Projects — CRUD + members + RBAC + soft-delete
6. Item types, statuses, priorities — seed + project copy on create
7. Items — CRUD + sequence numbering + cursor pagination + filters + export
8. Comments — CRUD, threading, @mentions, emoji reactions
9. Plans — CRUD (release/milestone/campaign/goal)
10. Roadmaps — interactive Gantt editor with lanes, drag scheduling, dependency arrows
11. Board — Kanban with drag-and-drop (dnd-kit)
12. Quick create — Cmd+K modal with duplicate detection
13. Search — PostgreSQL tsvector + GIN index
14. Tags — CRUD + M:N with items
15. Attachments — upload, clipboard paste, MIME validation, delete with image ref cleanup
16. Relations — 6 types with cross-project guard
17. Activity — async BullMQ logging (project + item level)
18. Notifications — @mention + assigned, real-time WebSocket, dropdown + full page
19. API Keys — clx_ prefix, SHA-256 hash, X-API-Key auth guard
20. Invite links — token-based, 7-day expiry, one-time use
21. Webhooks — configurable per project, event-based HTTP callbacks
22. Admin panel — user/project management, ADMIN_EMAILS guard
23. WebSocket real-time updates — Socket.IO gateway
24. Redis caching — membership (30 min), config (1 h)
25. Health endpoint — GET /health DB check
26. Dark mode — next-themes
27. Keyboard shortcuts — Cmd+K, /, ?, Escape
28. 404/error pages — custom not-found.tsx and error.tsx
29. nginx reverse proxy — production Docker setup
30. CI pipeline — GitHub Actions (lint → test → build)
31. Backup system — pg_dump + uploads, systemd/cron scheduling

### Missing / Not Yet Implemented

- Password reset / forgot password
- Email verification
- OAuth / Social login
- Two-factor auth
- Sprint / Scrum boards
- Time tracking (log start/stop)
- Email notifications
- Custom roles (beyond viewer/member/admin)
- Data import
- Server-side rendering (all pages are 'use client')

---

## 15. Known Quirks

- Drizzle Kit reads compiled output: `drizzle.config.ts` has `schema: './dist/src/database/schema/index.js'`
- `search_vector` generated column + GIN index applied via raw SQL after `drizzle-kit push` (Drizzle limitation)
- `forkJoin` in items-page/board-page fetch will log 403 errors for non-admin project checks — expected, not a bug
- Backend vitest config: `fileParallelism: false`, 15s timeout, serial execution (DB contention)
- SWC builder: decorators enabled for NestJS
- Next.js `output: 'standalone'` + `transpilePackages: ['@cordlyx/shared']`
