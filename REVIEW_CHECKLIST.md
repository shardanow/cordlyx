# Review Checklist

Human + agent checklist for every PR touching `backend/`, `frontend/` or `packages/shared/`.
CI enforces lint/test/build; this list covers what CI cannot see.

## Correctness
- [ ] New/changed behavior has a test (vitest unit; DB-backed service test for new queries).
- [ ] Error paths return the standard envelope (`{ statusCode, error, message, requestId }`) — no raw stack traces to clients.
- [ ] No `as any` / `as never` without a one-line comment explaining why the type gap exists.
- [ ] No `await import(...)` inside request handlers (top-level imports only).
- [ ] Zod schemas live in `@cordlyx/shared` when the frontend needs the same shape; backend-only helpers stay local.

## Auth & data safety
- [ ] New project-scoped route uses `ApiKeyOrJwtAuthGuard + ProjectMembershipGuard` (JWT-only only for auth/admin/key-management).
- [ ] New write route has `ProjectRoleGuard` with the minimal role (`member` for content, `admin` for config/members/destructive).
- [ ] New query is scoped by `projectId` (+ `deletedAt IS NULL` where soft-delete applies).
- [ ] File uploads: size limit, MIME/magic-byte check, never trust `originalname` for storage paths.

## Frontend
- [ ] No new local copies of shared components — reuse `components/features/` and `components/ui/` (AvatarCircle, TypeIcon, …).
- [ ] New user-facing text has loading/error/empty states; mutations invalidate the relevant React Query keys.
- [ ] UI change includes a screenshot or Loom in the PR description.
- [ ] `avatarUrl`/images: `<img>` always has `alt` and `object-cover`; fall back to initials, never broken-image icons.

## Transfer (import/export/bulk/snapshot)
- [ ] New import path supports `dryRun` (preview without writes) and reports per-row `{ created | skipped | failed }`.
- [ ] Dedupe rule documented in USER_GUIDE (what counts as "same").
- [ ] Export output re-imports cleanly (round-trip covered by test or by the API contract spec).
- [ ] Snapshot format bumped (`SNAPSHOT_VERSION`) with a migration note if fields change.

## Docs
- [ ] New endpoint appears in Swagger (correct tag) and in ARCHITECTURE.md §5.
- [ ] New/changed endpoint documents summary + path/query params + body + responses via `common/swagger` helpers (`ApiZodBody`/`ApiZodQuery`/param factories/`ApiErrorResponses`) — no hand-written duplicates of Zod schemas.
- [ ] `postman/` regenerated (`npm run docs:export`) when the API surface changes.
- [ ] USER_GUIDE updated when user-visible behavior changes (including curl example where relevant).
- [ ] No stale claims: grep the docs for the old behavior name and update every hit.

## Local verification
- [ ] `next build` only with the dev server stopped (they share `.next` — parallel runs corrupt it).
- [ ] New background jobs handled by both worker entrypoints (`src/worker.ts` and `worker/src/main.ts`).
