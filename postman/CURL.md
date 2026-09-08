# CordLyx API cookbook

Generated from OpenAPI. `BASE=http://localhost:4000/api/v1`, `AUTH="Authorization: Bearer <jwt>"` (or `-H "X-API-Key: clx_..."`).

## Auth

### POST /auth/register

```bash
curl -X POST "$BASE/auth/register" -H "$AUTH"
```

### POST /auth/login

```bash
curl -X POST "$BASE/auth/login" -H "$AUTH"
```

### POST /auth/refresh

```bash
curl -X POST "$BASE/auth/refresh" -H "$AUTH"
```

### POST /auth/logout

```bash
curl -X POST "$BASE/auth/logout" -H "$AUTH"
```

### PATCH /auth/change-password

```bash
curl -X PATCH "$BASE/auth/change-password" -H "$AUTH"
```

## Users

### GET /users/me

```bash
curl -X GET "$BASE/users/me" -H "$AUTH"
```

### PATCH /users/me

```bash
curl -X PATCH "$BASE/users/me" -H "$AUTH"
```

### DELETE /users/me

```bash
curl -X DELETE "$BASE/users/me" -H "$AUTH"
```

### GET /users/search?q=

```bash
curl -X GET "$BASE/users/search?q=" -H "$AUTH"
```

### POST /users/me/avatar

```bash
curl -X POST "$BASE/users/me/avatar" -H "$AUTH"
```

## projects

### POST /projects

```bash
curl -X POST "$BASE/projects" -H "$AUTH"
```

### GET /projects

```bash
curl -X GET "$BASE/projects" -H "$AUTH"
```

### GET /projects/:projectSlug

```bash
curl -X GET "$BASE/projects/:projectSlug" -H "$AUTH"
```

### PATCH /projects/:projectSlug

```bash
curl -X PATCH "$BASE/projects/:projectSlug" -H "$AUTH"
```

### DELETE /projects/:projectSlug

```bash
curl -X DELETE "$BASE/projects/:projectSlug" -H "$AUTH"
```

### POST /projects/:projectSlug/invites

```bash
curl -X POST "$BASE/projects/:projectSlug/invites" -H "$AUTH"
```

### GET /invites/:token

```bash
curl -X GET "$BASE/invites/:token" -H "$AUTH"
```

### POST /invites/:token/accept

```bash
curl -X POST "$BASE/invites/:token/accept" -H "$AUTH"
```

### GET /projects/:projectSlug/sync
Incremental sync: items touched after ?since=ISO (deleted included as stubs)

```bash
curl -X GET "$BASE/projects/:projectSlug/sync" -H "$AUTH"
```

### GET /projects/:projectSlug/snapshot/export
Export the whole project (config, plans, items, relations, roadmaps) as JSON

```bash
curl -X GET "$BASE/projects/:projectSlug/snapshot/export" -H "$AUTH"
```

### POST /projects/:projectSlug/snapshot/import?dedupe=&dryRun=
Import a snapshot into this project (merge by name/title, supports dryRun)

```bash
curl -X POST "$BASE/projects/:projectSlug/snapshot/import?dedupe=&dryRun=" -H "$AUTH" -F "file=@data.csv"
```

### POST /projects/snapshot/import-new?slug=&name=&dedupe=&dryRun=
Create a new project from a snapshot file (?slug=&name=, supports dryRun validation)

```bash
curl -X POST "$BASE/projects/snapshot/import-new?slug=&name=&dedupe=&dryRun=" -H "$AUTH" -F "file=@data.csv"
```

### GET /projects/:projectSlug/stats
Project overview: totals, funnel by status, overdue, workload by assignee

```bash
curl -X GET "$BASE/projects/:projectSlug/stats" -H "$AUTH"
```

### GET /projects/:projectSlug/views
List my views plus views shared with the project

```bash
curl -X GET "$BASE/projects/:projectSlug/views" -H "$AUTH"
```

### POST /projects/:projectSlug/views
Save a filter view (personal, optionally shared)

```bash
curl -X POST "$BASE/projects/:projectSlug/views" -H "$AUTH"
```

### PATCH /projects/:projectSlug/views/:id
Rename / edit filters / share (owner or admin)

```bash
curl -X PATCH "$BASE/projects/:projectSlug/views/:id" -H "$AUTH"
```

### DELETE /projects/:projectSlug/views/:id
Delete a view (owner or admin)

```bash
curl -X DELETE "$BASE/projects/:projectSlug/views/:id" -H "$AUTH"
```

### POST /projects/:projectSlug/views/:id/set-default
Make a view the project default (admin)

```bash
curl -X POST "$BASE/projects/:projectSlug/views/:id/set-default" -H "$AUTH"
```

## ProjectMembers

### GET /projects/:projectSlug/members

```bash
curl -X GET "$BASE/projects/:projectSlug/members" -H "$AUTH"
```

### POST /projects/:projectSlug/members

```bash
curl -X POST "$BASE/projects/:projectSlug/members" -H "$AUTH"
```

### PATCH /projects/:projectSlug/members/:memberId

```bash
curl -X PATCH "$BASE/projects/:projectSlug/members/:memberId" -H "$AUTH"
```

### DELETE /projects/:projectSlug/members/:memberId

```bash
curl -X DELETE "$BASE/projects/:projectSlug/members/:memberId" -H "$AUTH"
```

## project-config

### GET /projects/:projectSlug/types

```bash
curl -X GET "$BASE/projects/:projectSlug/types" -H "$AUTH"
```

### POST /projects/:projectSlug/types

```bash
curl -X POST "$BASE/projects/:projectSlug/types" -H "$AUTH"
```

### PATCH /projects/:projectSlug/types/:id

```bash
curl -X PATCH "$BASE/projects/:projectSlug/types/:id" -H "$AUTH"
```

### DELETE /projects/:projectSlug/types/:id

```bash
curl -X DELETE "$BASE/projects/:projectSlug/types/:id" -H "$AUTH"
```

### GET /projects/:projectSlug/statuses

```bash
curl -X GET "$BASE/projects/:projectSlug/statuses" -H "$AUTH"
```

### POST /projects/:projectSlug/statuses

```bash
curl -X POST "$BASE/projects/:projectSlug/statuses" -H "$AUTH"
```

### PATCH /projects/:projectSlug/statuses/:id

```bash
curl -X PATCH "$BASE/projects/:projectSlug/statuses/:id" -H "$AUTH"
```

### DELETE /projects/:projectSlug/statuses/:id

```bash
curl -X DELETE "$BASE/projects/:projectSlug/statuses/:id" -H "$AUTH"
```

### GET /projects/:projectSlug/priorities

```bash
curl -X GET "$BASE/projects/:projectSlug/priorities" -H "$AUTH"
```

### POST /projects/:projectSlug/priorities

```bash
curl -X POST "$BASE/projects/:projectSlug/priorities" -H "$AUTH"
```

### PATCH /projects/:projectSlug/priorities/:id

```bash
curl -X PATCH "$BASE/projects/:projectSlug/priorities/:id" -H "$AUTH"
```

### DELETE /projects/:projectSlug/priorities/:id

```bash
curl -X DELETE "$BASE/projects/:projectSlug/priorities/:id" -H "$AUTH"
```

### GET /projects/:projectSlug/config/export
Export project config (types, statuses, priorities, tags) as a JSON template

```bash
curl -X GET "$BASE/projects/:projectSlug/config/export" -H "$AUTH"
```

### POST /projects/:projectSlug/config/import?dryRun=
Import a config JSON template (upsert by name, never deletes)

```bash
curl -X POST "$BASE/projects/:projectSlug/config/import?dryRun=" -H "$AUTH" -F "file=@data.csv"
```

## items

### GET /projects/:projectSlug/items
List items (cursor pagination, filters). Supports If-None-Match/ETag.

```bash
curl -X GET "$BASE/projects/:projectSlug/items" -H "$AUTH"
```

### POST /projects/:projectSlug/items

```bash
curl -X POST "$BASE/projects/:projectSlug/items" -H "$AUTH"
```

### GET /projects/:projectSlug/items/export?format=
Export project items as CSV, JSON or JSONL (?format=csv|json|jsonl)

```bash
curl -X GET "$BASE/projects/:projectSlug/items/export?format=" -H "$AUTH"
```

### POST /projects/:projectSlug/items/bulk?dedupe=&dryRun=
Create up to 100 items in one request (supports dedupe and dryRun)

```bash
curl -X POST "$BASE/projects/:projectSlug/items/bulk?dedupe=&dryRun=" -H "$AUTH"
```

### POST /projects/:projectSlug/items/import?dedupe=&dryRun=
Import items from a CSV, JSON or JSONL file (max 10 MB, 100 rows)

```bash
curl -X POST "$BASE/projects/:projectSlug/items/import?dedupe=&dryRun=" -H "$AUTH" -F "file=@data.csv"
```

### GET /projects/:projectSlug/items/:sequenceNum

```bash
curl -X GET "$BASE/projects/:projectSlug/items/:sequenceNum" -H "$AUTH"
```

### POST /projects/:projectSlug/items/check-duplicates

```bash
curl -X POST "$BASE/projects/:projectSlug/items/check-duplicates" -H "$AUTH"
```

### POST /projects/:projectSlug/items/:id/clone

```bash
curl -X POST "$BASE/projects/:projectSlug/items/:id/clone" -H "$AUTH"
```

### PATCH /projects/:projectSlug/items/:id

```bash
curl -X PATCH "$BASE/projects/:projectSlug/items/:id" -H "$AUTH"
```

### DELETE /projects/:projectSlug/items/:id

```bash
curl -X DELETE "$BASE/projects/:projectSlug/items/:id" -H "$AUTH"
```

### POST /projects/:projectSlug/items/:id/vote

```bash
curl -X POST "$BASE/projects/:projectSlug/items/:id/vote" -H "$AUTH"
```

### GET /projects/:projectSlug/items/:id/votes

```bash
curl -X GET "$BASE/projects/:projectSlug/items/:id/votes" -H "$AUTH"
```

## Board

### GET /projects/:projectSlug/board

```bash
curl -X GET "$BASE/projects/:projectSlug/board" -H "$AUTH"
```

### PATCH /projects/:projectSlug/board/:itemId

```bash
curl -X PATCH "$BASE/projects/:projectSlug/board/:itemId" -H "$AUTH"
```

## QuickCreate

### POST /quick-create

```bash
curl -X POST "$BASE/quick-create" -H "$AUTH"
```

## plans

### GET /projects/:projectSlug/plans

```bash
curl -X GET "$BASE/projects/:projectSlug/plans" -H "$AUTH"
```

### POST /projects/:projectSlug/plans

```bash
curl -X POST "$BASE/projects/:projectSlug/plans" -H "$AUTH"
```

### PATCH /projects/:projectSlug/plans/:id

```bash
curl -X PATCH "$BASE/projects/:projectSlug/plans/:id" -H "$AUTH"
```

### DELETE /projects/:projectSlug/plans/:id

```bash
curl -X DELETE "$BASE/projects/:projectSlug/plans/:id" -H "$AUTH"
```

### GET /projects/:projectSlug/plans/export?format=
Export project plans as CSV, JSON or JSONL (?format=csv|json|jsonl)

```bash
curl -X GET "$BASE/projects/:projectSlug/plans/export?format=" -H "$AUTH"
```

### POST /projects/:projectSlug/plans/bulk?dedupe=&dryRun=
Create up to 100 plans in one request (supports dedupe and dryRun)

```bash
curl -X POST "$BASE/projects/:projectSlug/plans/bulk?dedupe=&dryRun=" -H "$AUTH"
```

### POST /projects/:projectSlug/plans/import?dedupe=&dryRun=
Import plans from a CSV, JSON or JSONL file (max 10 MB, 100 rows)

```bash
curl -X POST "$BASE/projects/:projectSlug/plans/import?dedupe=&dryRun=" -H "$AUTH" -F "file=@data.csv"
```

## roadmaps

### GET /projects/:projectSlug/roadmaps

```bash
curl -X GET "$BASE/projects/:projectSlug/roadmaps" -H "$AUTH"
```

### POST /projects/:projectSlug/roadmaps

```bash
curl -X POST "$BASE/projects/:projectSlug/roadmaps" -H "$AUTH"
```

### GET /projects/:projectSlug/roadmaps/export?format=
Export all project roadmaps with lanes and schedule (?format=json|csv)

```bash
curl -X GET "$BASE/projects/:projectSlug/roadmaps/export?format=" -H "$AUTH"
```

### GET /projects/:projectSlug/roadmaps/:id/export
Export a single roadmap with lanes and schedule as JSON

```bash
curl -X GET "$BASE/projects/:projectSlug/roadmaps/:id/export" -H "$AUTH"
```

### GET /projects/:projectSlug/roadmaps/:id

```bash
curl -X GET "$BASE/projects/:projectSlug/roadmaps/:id" -H "$AUTH"
```

### PATCH /projects/:projectSlug/roadmaps/:id

```bash
curl -X PATCH "$BASE/projects/:projectSlug/roadmaps/:id" -H "$AUTH"
```

### DELETE /projects/:projectSlug/roadmaps/:id

```bash
curl -X DELETE "$BASE/projects/:projectSlug/roadmaps/:id" -H "$AUTH"
```

### GET /projects/:projectSlug/roadmaps/:id/items

```bash
curl -X GET "$BASE/projects/:projectSlug/roadmaps/:id/items" -H "$AUTH"
```

### GET /projects/:projectSlug/roadmaps/:id/relations

```bash
curl -X GET "$BASE/projects/:projectSlug/roadmaps/:id/relations" -H "$AUTH"
```

### POST /projects/:projectSlug/roadmaps/import?dedupe=&dryRun=
Import roadmaps from a JSON file (lanes auto-created, items resolved by sequence number)

```bash
curl -X POST "$BASE/projects/:projectSlug/roadmaps/import?dedupe=&dryRun=" -H "$AUTH" -F "file=@data.csv"
```

### POST /projects/:projectSlug/roadmaps/:id/lanes

```bash
curl -X POST "$BASE/projects/:projectSlug/roadmaps/:id/lanes" -H "$AUTH"
```

### PATCH /projects/:projectSlug/roadmaps/:id/lanes/reorder
Reorder lanes atomically (ordered lane ids)

```bash
curl -X PATCH "$BASE/projects/:projectSlug/roadmaps/:id/lanes/reorder" -H "$AUTH"
```

### PATCH /projects/:projectSlug/roadmaps/:id/lanes/:laneId

```bash
curl -X PATCH "$BASE/projects/:projectSlug/roadmaps/:id/lanes/:laneId" -H "$AUTH"
```

### DELETE /projects/:projectSlug/roadmaps/:id/lanes/:laneId

```bash
curl -X DELETE "$BASE/projects/:projectSlug/roadmaps/:id/lanes/:laneId" -H "$AUTH"
```

### POST /projects/:projectSlug/roadmaps/:id/schedule

```bash
curl -X POST "$BASE/projects/:projectSlug/roadmaps/:id/schedule" -H "$AUTH"
```

### DELETE /projects/:projectSlug/roadmaps/:id/items/:itemId

```bash
curl -X DELETE "$BASE/projects/:projectSlug/roadmaps/:id/items/:itemId" -H "$AUTH"
```

### PATCH /projects/:projectSlug/roadmaps/:id/items/:itemId

```bash
curl -X PATCH "$BASE/projects/:projectSlug/roadmaps/:id/items/:itemId" -H "$AUTH"
```

## comments

### GET /projects/:projectSlug/items/:itemId/comments

```bash
curl -X GET "$BASE/projects/:projectSlug/items/:itemId/comments" -H "$AUTH"
```

### POST /projects/:projectSlug/items/:itemId/comments

```bash
curl -X POST "$BASE/projects/:projectSlug/items/:itemId/comments" -H "$AUTH"
```

### PATCH /projects/:projectSlug/items/:itemId/comments/:commentId

```bash
curl -X PATCH "$BASE/projects/:projectSlug/items/:itemId/comments/:commentId" -H "$AUTH"
```

### DELETE /projects/:projectSlug/items/:itemId/comments/:commentId

```bash
curl -X DELETE "$BASE/projects/:projectSlug/items/:itemId/comments/:commentId" -H "$AUTH"
```

## Reactions

### POST /projects/:projectSlug/items/:itemId/comments/:commentId/reactions

```bash
curl -X POST "$BASE/projects/:projectSlug/items/:itemId/comments/:commentId/reactions" -H "$AUTH"
```

### DELETE /projects/:projectSlug/items/:itemId/comments/:commentId/reactions/:reaction

```bash
curl -X DELETE "$BASE/projects/:projectSlug/items/:itemId/comments/:commentId/reactions/:reaction" -H "$AUTH"
```

## Tags

### GET /projects/:projectSlug/tags

```bash
curl -X GET "$BASE/projects/:projectSlug/tags" -H "$AUTH"
```

### POST /projects/:projectSlug/tags

```bash
curl -X POST "$BASE/projects/:projectSlug/tags" -H "$AUTH"
```

### PATCH /projects/:projectSlug/tags/:id

```bash
curl -X PATCH "$BASE/projects/:projectSlug/tags/:id" -H "$AUTH"
```

### DELETE /projects/:projectSlug/tags/:id

```bash
curl -X DELETE "$BASE/projects/:projectSlug/tags/:id" -H "$AUTH"
```

## attachments

### GET /projects/:projectSlug/items/:itemId/attachments

```bash
curl -X GET "$BASE/projects/:projectSlug/items/:itemId/attachments" -H "$AUTH"
```

### POST /projects/:projectSlug/items/:itemId/attachments

```bash
curl -X POST "$BASE/projects/:projectSlug/items/:itemId/attachments" -H "$AUTH"
```

### DELETE /projects/:projectSlug/items/:itemId/attachments/:id

```bash
curl -X DELETE "$BASE/projects/:projectSlug/items/:itemId/attachments/:id" -H "$AUTH"
```

## Relations

### GET /projects/:projectSlug/items/:itemId/relations

```bash
curl -X GET "$BASE/projects/:projectSlug/items/:itemId/relations" -H "$AUTH"
```

### POST /projects/:projectSlug/items/:itemId/relations

```bash
curl -X POST "$BASE/projects/:projectSlug/items/:itemId/relations" -H "$AUTH"
```

### DELETE /projects/:projectSlug/items/:itemId/relations/:id

```bash
curl -X DELETE "$BASE/projects/:projectSlug/items/:itemId/relations/:id" -H "$AUTH"
```

## Activities

### GET /projects/:projectSlug/activity

```bash
curl -X GET "$BASE/projects/:projectSlug/activity" -H "$AUTH"
```

### GET /projects/:projectSlug/items/:itemId/activity

```bash
curl -X GET "$BASE/projects/:projectSlug/items/:itemId/activity" -H "$AUTH"
```

## Search

### GET /search

```bash
curl -X GET "$BASE/search" -H "$AUTH"
```

## api-keys

### GET /api-keys

```bash
curl -X GET "$BASE/api-keys" -H "$AUTH"
```

### POST /api-keys

```bash
curl -X POST "$BASE/api-keys" -H "$AUTH"
```

### PATCH /api-keys/:id

```bash
curl -X PATCH "$BASE/api-keys/:id" -H "$AUTH"
```

### DELETE /api-keys/:id

```bash
curl -X DELETE "$BASE/api-keys/:id" -H "$AUTH"
```

## notifications

### GET /notifications?cursor=&limit=

```bash
curl -X GET "$BASE/notifications?cursor=&limit=" -H "$AUTH"
```

### GET /notifications/unread

```bash
curl -X GET "$BASE/notifications/unread" -H "$AUTH"
```

### GET /notifications/unread/count

```bash
curl -X GET "$BASE/notifications/unread/count" -H "$AUTH"
```

### PATCH /notifications/:id/read

```bash
curl -X PATCH "$BASE/notifications/:id/read" -H "$AUTH"
```

### PATCH /notifications/read-all

```bash
curl -X PATCH "$BASE/notifications/read-all" -H "$AUTH"
```

### GET /notifications/prefs
My per-project notification preferences

```bash
curl -X GET "$BASE/notifications/prefs" -H "$AUTH"
```

### PUT /notifications/prefs/:projectSlug
Mute / digest settings for one project (self)

```bash
curl -X PUT "$BASE/notifications/prefs/:projectSlug" -H "$AUTH"
```

### POST /notifications/digest/send
Send myself an email digest of unread notifications now

```bash
curl -X POST "$BASE/notifications/digest/send" -H "$AUTH"
```

### POST /notifications/digest/run-hour?hour=
Run the hourly digest fan-out (server admin; same work the scheduler does)

```bash
curl -X POST "$BASE/notifications/digest/run-hour?hour=" -H "$AUTH"
```

## Admin

### GET /admin/check

```bash
curl -X GET "$BASE/admin/check" -H "$AUTH"
```

### GET /admin/stats

```bash
curl -X GET "$BASE/admin/stats" -H "$AUTH"
```

### GET /admin/users

```bash
curl -X GET "$BASE/admin/users" -H "$AUTH"
```

### PATCH /admin/users/:id/make-admin

```bash
curl -X PATCH "$BASE/admin/users/:id/make-admin" -H "$AUTH"
```

### PATCH /admin/users/:id/deactivate

```bash
curl -X PATCH "$BASE/admin/users/:id/deactivate" -H "$AUTH"
```

### GET /admin/projects

```bash
curl -X GET "$BASE/admin/projects" -H "$AUTH"
```

### GET /admin/projects/:id/members

```bash
curl -X GET "$BASE/admin/projects/:id/members" -H "$AUTH"
```

### PATCH /admin/projects/:id/members/:memberId/role

```bash
curl -X PATCH "$BASE/admin/projects/:id/members/:memberId/role" -H "$AUTH"
```

### PATCH /admin/projects/:id/archive

```bash
curl -X PATCH "$BASE/admin/projects/:id/archive" -H "$AUTH"
```

### DELETE /admin/projects/:id

```bash
curl -X DELETE "$BASE/admin/projects/:id" -H "$AUTH"
```

### GET /admin/activity?cursor=&limit=

```bash
curl -X GET "$BASE/admin/activity?cursor=&limit=" -H "$AUTH"
```

## webhooks

### GET /projects/:projectSlug/webhooks
List webhooks with last delivery status (secrets never exposed)

```bash
curl -X GET "$BASE/projects/:projectSlug/webhooks" -H "$AUTH"
```

### POST /projects/:projectSlug/webhooks
Create webhook (returns signing secret once — store it)

```bash
curl -X POST "$BASE/projects/:projectSlug/webhooks" -H "$AUTH"
```

### POST /projects/:projectSlug/webhooks/:id/regenerate-secret
Rotate the signing secret (returns the new secret once)

```bash
curl -X POST "$BASE/projects/:projectSlug/webhooks/:id/regenerate-secret" -H "$AUTH"
```

### GET /projects/:projectSlug/webhooks/:id/deliveries?limit=
Recent delivery attempts for a webhook (30-day retention)

```bash
curl -X GET "$BASE/projects/:projectSlug/webhooks/:id/deliveries?limit=" -H "$AUTH"
```

### PATCH /projects/:projectSlug/webhooks/:id

```bash
curl -X PATCH "$BASE/projects/:projectSlug/webhooks/:id" -H "$AUTH"
```

### DELETE /projects/:projectSlug/webhooks/:id

```bash
curl -X DELETE "$BASE/projects/:projectSlug/webhooks/:id" -H "$AUTH"
```

