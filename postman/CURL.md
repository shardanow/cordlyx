# CordLyx API cookbook

Generated from OpenAPI. `BASE=http://localhost:4000/api/v1`, `AUTH="Authorization: Bearer <jwt>"` (or `-H "X-API-Key: clx_..."`).

## Auth

### POST /auth/register
Create account

```bash
curl -X POST "$BASE/auth/register" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "username": "string",
  "email": "string",
  "password": "string",
  "name": "string"
}'
```

### POST /auth/login
Login with username or email

```bash
curl -X POST "$BASE/auth/login" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "login": "string",
  "password": "string"
}'
```

### POST /auth/refresh
Rotate refresh token

```bash
curl -X POST "$BASE/auth/refresh" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "refreshToken": "string"
}'
```

### POST /auth/logout
Revoke a refresh token and log out

```bash
curl -X POST "$BASE/auth/logout" -H "$AUTH"
```

### PATCH /auth/change-password
Change current password

```bash
curl -X PATCH "$BASE/auth/change-password" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "currentPassword": "string",
  "newPassword": "string"
}'
```

## Users

### GET /users/me
Get current user profile

```bash
curl -X GET "$BASE/users/me" -H "$AUTH"
```

### PATCH /users/me
Update your profile (name, avatar)

```bash
curl -X PATCH "$BASE/users/me" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "name": "string",
  "avatarUrl": null
}'
```

### DELETE /users/me
Delete your account (irreversible)

```bash
curl -X DELETE "$BASE/users/me" -H "$AUTH"
```

### GET /users/search?q=
Search users by name or email (member picker)

```bash
curl -X GET "$BASE/users/search?q=" -H "$AUTH"
```

### POST /users/me/avatar
Upload your avatar (JPEG/PNG/GIF/WebP, 5 MB max)

```bash
curl -X POST "$BASE/users/me/avatar" -H "$AUTH" -F "file=@data.csv"
```

## projects

### POST /projects
Create a project (you become its admin)

```bash
curl -X POST "$BASE/projects" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "name": "string",
  "slug": "string",
  "description": null
}'
```

### GET /projects
List my projects (member of, not archived)

```bash
curl -X GET "$BASE/projects" -H "$AUTH"
```

### GET /projects/:projectSlug
Get one project by slug

```bash
curl -X GET "$BASE/projects/:projectSlug" -H "$AUTH"
```

### PATCH /projects/:projectSlug
Update project settings (admin only)

```bash
curl -X PATCH "$BASE/projects/:projectSlug" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "name": "string",
  "slug": "string",
  "description": null,
  "isArchived": true,
  "settings": {}
}'
```

### DELETE /projects/:projectSlug
Archive a project (admin only)

```bash
curl -X DELETE "$BASE/projects/:projectSlug" -H "$AUTH"
```

### POST /projects/:projectSlug/invites
Create a one-time invite link (admin only, 7-day expiry)

```bash
curl -X POST "$BASE/projects/:projectSlug/invites" -H "$AUTH"
```

### GET /invites/:token
Preview an invite (project name, inviter)

```bash
curl -X GET "$BASE/invites/:token" -H "$AUTH"
```

### POST /invites/:token/accept
Accept an invite (join the project as member)

```bash
curl -X POST "$BASE/invites/:token/accept" -H "$AUTH"
```

### GET /projects/:projectSlug/sync?since=&limit=
Incremental sync: items touched after ?since=ISO (deleted included as stubs)

```bash
curl -X GET "$BASE/projects/:projectSlug/sync?since=&limit=" -H "$AUTH"
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
curl -X POST "$BASE/projects/:projectSlug/views" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "name": "string",
  "filters": {
    "typeId": null,
    "statusId": null,
    "priorityId": null,
    "assigneeId": null,
    "planId": null,
    "search": "string"
  },
  "isShared": true
}'
```

### PATCH /projects/:projectSlug/views/:id
Rename / edit filters / share (owner or admin)

```bash
curl -X PATCH "$BASE/projects/:projectSlug/views/:id" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "name": "string",
  "filters": {
    "typeId": null,
    "statusId": null,
    "priorityId": null,
    "assigneeId": null,
    "planId": null,
    "search": "string"
  },
  "isShared": true
}'
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
List project members with roles

```bash
curl -X GET "$BASE/projects/:projectSlug/members" -H "$AUTH"
```

### POST /projects/:projectSlug/members
Add a member by userId or email (admin only)

```bash
curl -X POST "$BASE/projects/:projectSlug/members" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "userId": "00000000-0000-0000-0000-000000000001",
  "email": "string",
  "role": "admin"
}'
```

### PATCH /projects/:projectSlug/members/:memberId
Change a member role (admin only)

```bash
curl -X PATCH "$BASE/projects/:projectSlug/members/:memberId" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "role": "admin"
}'
```

### DELETE /projects/:projectSlug/members/:memberId
Remove a member (admin only)

```bash
curl -X DELETE "$BASE/projects/:projectSlug/members/:memberId" -H "$AUTH"
```

## project-config

### GET /projects/:projectSlug/types
List item types

```bash
curl -X GET "$BASE/projects/:projectSlug/types" -H "$AUTH"
```

### POST /projects/:projectSlug/types
Create an item type (admin only)

```bash
curl -X POST "$BASE/projects/:projectSlug/types" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "name": "string",
  "color": "string",
  "icon": null,
  "sortOrder": 1
}'
```

### PATCH /projects/:projectSlug/types/:id
Update an item type (admin only, partial)

```bash
curl -X PATCH "$BASE/projects/:projectSlug/types/:id" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "name": "string",
  "color": "string",
  "icon": null,
  "sortOrder": 1
}'
```

### DELETE /projects/:projectSlug/types/:id
Delete an item type (admin only)

```bash
curl -X DELETE "$BASE/projects/:projectSlug/types/:id" -H "$AUTH"
```

### GET /projects/:projectSlug/statuses
List item statuses

```bash
curl -X GET "$BASE/projects/:projectSlug/statuses" -H "$AUTH"
```

### POST /projects/:projectSlug/statuses
Create an item status (admin only)

```bash
curl -X POST "$BASE/projects/:projectSlug/statuses" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "name": "string",
  "color": "string",
  "category": "inbox",
  "sortOrder": 1
}'
```

### PATCH /projects/:projectSlug/statuses/:id
Update an item status (admin only, partial)

```bash
curl -X PATCH "$BASE/projects/:projectSlug/statuses/:id" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "name": "string",
  "color": "string",
  "category": "inbox",
  "sortOrder": 1
}'
```

### DELETE /projects/:projectSlug/statuses/:id
Delete an item status (admin only)

```bash
curl -X DELETE "$BASE/projects/:projectSlug/statuses/:id" -H "$AUTH"
```

### GET /projects/:projectSlug/priorities
List item priorities

```bash
curl -X GET "$BASE/projects/:projectSlug/priorities" -H "$AUTH"
```

### POST /projects/:projectSlug/priorities
Create an item priority (admin only)

```bash
curl -X POST "$BASE/projects/:projectSlug/priorities" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "name": "string",
  "color": null,
  "icon": null,
  "sortOrder": 1
}'
```

### PATCH /projects/:projectSlug/priorities/:id
Update an item priority (admin only, partial)

```bash
curl -X PATCH "$BASE/projects/:projectSlug/priorities/:id" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "name": "string",
  "color": null,
  "icon": null,
  "sortOrder": 1
}'
```

### DELETE /projects/:projectSlug/priorities/:id
Delete an item priority (admin only)

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

### GET /projects/:projectSlug/items?cursor=&limit=&typeId=&statusId=&priorityId=&assigneeId=&reporterId=&tagIds=&parentId=&planId=&search=&sort=
List items (cursor pagination, filters). Supports If-None-Match/ETag.

```bash
curl -X GET "$BASE/projects/:projectSlug/items?cursor=&limit=&typeId=&statusId=&priorityId=&assigneeId=&reporterId=&tagIds=&parentId=&planId=&search=&sort=" -H "$AUTH"
```

### POST /projects/:projectSlug/items
Create one item (sequence number assigned automatically)

```bash
curl -X POST "$BASE/projects/:projectSlug/items" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "title": "string",
  "description": null,
  "typeId": "00000000-0000-0000-0000-000000000001",
  "statusId": "00000000-0000-0000-0000-000000000001",
  "priorityId": "00000000-0000-0000-0000-000000000001",
  "assigneeId": null,
  "parentId": null,
  "dueDate": null,
  "startDate": null,
  "estimatedHours": null,
  "tagIds": [
    "00000000-0000-0000-0000-000000000001"
  ],
  "planId": null,
  "roadmapId": null
}'
```

### GET /projects/:projectSlug/items/export?format=
Export project items as CSV, JSON or JSONL (?format=csv|json|jsonl)

```bash
curl -X GET "$BASE/projects/:projectSlug/items/export?format=" -H "$AUTH"
```

### POST /projects/:projectSlug/items/bulk?dedupe=&dryRun=
Create up to 100 items in one request (supports dedupe and dryRun)

```bash
curl -X POST "$BASE/projects/:projectSlug/items/bulk?dedupe=&dryRun=" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "items": [
    null
  ],
  "dedupe": true,
  "dryRun": true
}'
```

### POST /projects/:projectSlug/items/import?dedupe=&dryRun=
Import items from a CSV, JSON or JSONL file (max 10 MB, 100 rows)

```bash
curl -X POST "$BASE/projects/:projectSlug/items/import?dedupe=&dryRun=" -H "$AUTH" -F "file=@data.csv"
```

### GET /projects/:projectSlug/items/:sequenceNum
Get one item by its sequence number

```bash
curl -X GET "$BASE/projects/:projectSlug/items/:sequenceNum" -H "$AUTH"
```

### POST /projects/:projectSlug/items/check-duplicates
Find existing items with a similar title (quick-create helper)

```bash
curl -X POST "$BASE/projects/:projectSlug/items/check-duplicates" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "title": "string"
}'
```

### POST /projects/:projectSlug/items/:id/clone
Clone an item (new sequence number, same content)

```bash
curl -X POST "$BASE/projects/:projectSlug/items/:id/clone" -H "$AUTH"
```

### PATCH /projects/:projectSlug/items/:id
Update item fields (partial)

```bash
curl -X PATCH "$BASE/projects/:projectSlug/items/:id" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "title": "string",
  "description": null,
  "typeId": "00000000-0000-0000-0000-000000000001",
  "statusId": "00000000-0000-0000-0000-000000000001",
  "priorityId": "00000000-0000-0000-0000-000000000001",
  "assigneeId": null,
  "parentId": null,
  "dueDate": null,
  "startDate": null,
  "estimatedHours": null,
  "tagIds": [
    "00000000-0000-0000-0000-000000000001"
  ],
  "planId": null,
  "roadmapId": null
}'
```

### DELETE /projects/:projectSlug/items/:id
Soft-delete an item

```bash
curl -X DELETE "$BASE/projects/:projectSlug/items/:id" -H "$AUTH"
```

### POST /projects/:projectSlug/items/:id/vote
Toggle your vote on an item

```bash
curl -X POST "$BASE/projects/:projectSlug/items/:id/vote" -H "$AUTH"
```

### GET /projects/:projectSlug/items/:id/votes
List votes on an item

```bash
curl -X GET "$BASE/projects/:projectSlug/items/:id/votes" -H "$AUTH"
```

## Board

### GET /projects/:projectSlug/board
Get Kanban board (columns with items)

```bash
curl -X GET "$BASE/projects/:projectSlug/board" -H "$AUTH"
```

### PATCH /projects/:projectSlug/board/:itemId
Move an item (drag-and-drop: status + order)

```bash
curl -X PATCH "$BASE/projects/:projectSlug/board/:itemId" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "statusId": "00000000-0000-0000-0000-000000000001",
  "sortOrder": 1
}'
```

## QuickCreate

### POST /quick-create
Quick-create one item (project resolved from body slug, member+ required)

```bash
curl -X POST "$BASE/quick-create" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "title": "string",
  "typeId": "00000000-0000-0000-0000-000000000001",
  "projectSlug": "string",
  "statusId": "00000000-0000-0000-0000-000000000001",
  "planId": null,
  "description": "string"
}'
```

## plans

### GET /projects/:projectSlug/plans
List project plans

```bash
curl -X GET "$BASE/projects/:projectSlug/plans" -H "$AUTH"
```

### POST /projects/:projectSlug/plans
Create a plan

```bash
curl -X POST "$BASE/projects/:projectSlug/plans" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "name": "string",
  "type": "release",
  "description": "string",
  "color": "string",
  "status": "active",
  "sortOrder": 1
}'
```

### PATCH /projects/:projectSlug/plans/:id
Update a plan (partial)

```bash
curl -X PATCH "$BASE/projects/:projectSlug/plans/:id" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "name": "string",
  "type": "release",
  "description": "string",
  "color": "string",
  "status": "active",
  "sortOrder": 1
}'
```

### DELETE /projects/:projectSlug/plans/:id
Delete a plan

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
curl -X POST "$BASE/projects/:projectSlug/plans/bulk?dedupe=&dryRun=" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "items": [
    null
  ],
  "dedupe": true,
  "dryRun": true
}'
```

### POST /projects/:projectSlug/plans/import?dedupe=&dryRun=
Import plans from a CSV, JSON or JSONL file (max 10 MB, 100 rows)

```bash
curl -X POST "$BASE/projects/:projectSlug/plans/import?dedupe=&dryRun=" -H "$AUTH" -F "file=@data.csv"
```

## roadmaps

### GET /projects/:projectSlug/roadmaps?sort=&search=
List project roadmaps (filter, sort)

```bash
curl -X GET "$BASE/projects/:projectSlug/roadmaps?sort=&search=" -H "$AUTH"
```

### POST /projects/:projectSlug/roadmaps
Create a roadmap

```bash
curl -X POST "$BASE/projects/:projectSlug/roadmaps" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "name": "string",
  "description": null,
  "startDate": "string",
  "endDate": "string",
  "color": null,
  "sortOrder": 1
}'
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
Get one roadmap with lanes

```bash
curl -X GET "$BASE/projects/:projectSlug/roadmaps/:id" -H "$AUTH"
```

### PATCH /projects/:projectSlug/roadmaps/:id
Update a roadmap (partial)

```bash
curl -X PATCH "$BASE/projects/:projectSlug/roadmaps/:id" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "name": "string",
  "description": null,
  "startDate": "string",
  "endDate": "string",
  "color": null,
  "sortOrder": 1
}'
```

### DELETE /projects/:projectSlug/roadmaps/:id
Delete a roadmap

```bash
curl -X DELETE "$BASE/projects/:projectSlug/roadmaps/:id" -H "$AUTH"
```

### GET /projects/:projectSlug/roadmaps/:id/items
Get a roadmap with its scheduled items

```bash
curl -X GET "$BASE/projects/:projectSlug/roadmaps/:id/items" -H "$AUTH"
```

### GET /projects/:projectSlug/roadmaps/:id/relations
Get relations between items on a roadmap

```bash
curl -X GET "$BASE/projects/:projectSlug/roadmaps/:id/relations" -H "$AUTH"
```

### POST /projects/:projectSlug/roadmaps/import?dedupe=&dryRun=
Import roadmaps from a JSON file (lanes auto-created, items resolved by sequence number)

```bash
curl -X POST "$BASE/projects/:projectSlug/roadmaps/import?dedupe=&dryRun=" -H "$AUTH" -F "file=@data.csv"
```

### POST /projects/:projectSlug/roadmaps/:id/lanes
Add a lane to a roadmap

```bash
curl -X POST "$BASE/projects/:projectSlug/roadmaps/:id/lanes" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "name": "string",
  "icon": null,
  "color": null,
  "sortOrder": 1
}'
```

### PATCH /projects/:projectSlug/roadmaps/:id/lanes/reorder
Reorder lanes atomically (ordered lane ids)

```bash
curl -X PATCH "$BASE/projects/:projectSlug/roadmaps/:id/lanes/reorder" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "laneIds": [
    "00000000-0000-0000-0000-000000000001"
  ]
}'
```

### PATCH /projects/:projectSlug/roadmaps/:id/lanes/:laneId
Update a lane (partial)

```bash
curl -X PATCH "$BASE/projects/:projectSlug/roadmaps/:id/lanes/:laneId" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "name": "string",
  "icon": null,
  "color": null,
  "sortOrder": 1
}'
```

### DELETE /projects/:projectSlug/roadmaps/:id/lanes/:laneId
Delete a lane (items stay unscheduled)

```bash
curl -X DELETE "$BASE/projects/:projectSlug/roadmaps/:id/lanes/:laneId" -H "$AUTH"
```

### POST /projects/:projectSlug/roadmaps/:id/schedule
Schedule items onto a roadmap with dates

```bash
curl -X POST "$BASE/projects/:projectSlug/roadmaps/:id/schedule" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "itemIds": [
    "00000000-0000-0000-0000-000000000001"
  ],
  "laneId": null,
  "startDate": null,
  "dueDate": null
}'
```

### DELETE /projects/:projectSlug/roadmaps/:id/items/:itemId
Unschedule an item from a roadmap

```bash
curl -X DELETE "$BASE/projects/:projectSlug/roadmaps/:id/items/:itemId" -H "$AUTH"
```

### PATCH /projects/:projectSlug/roadmaps/:id/items/:itemId
Update scheduled dates/lane of an item

```bash
curl -X PATCH "$BASE/projects/:projectSlug/roadmaps/:id/items/:itemId" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "startDate": null,
  "dueDate": null,
  "laneId": null
}'
```

## comments

### GET /projects/:projectSlug/items/:itemId/comments
List comments on an item (with replies and reactions)

```bash
curl -X GET "$BASE/projects/:projectSlug/items/:itemId/comments" -H "$AUTH"
```

### POST /projects/:projectSlug/items/:itemId/comments
Add a comment (or a reply via parentId, @mentions notify)

```bash
curl -X POST "$BASE/projects/:projectSlug/items/:itemId/comments" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "body": "string",
  "parentId": null
}'
```

### PATCH /projects/:projectSlug/items/:itemId/comments/:commentId
Edit your comment

```bash
curl -X PATCH "$BASE/projects/:projectSlug/items/:itemId/comments/:commentId" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "body": "string"
}'
```

### DELETE /projects/:projectSlug/items/:itemId/comments/:commentId
Delete your comment

```bash
curl -X DELETE "$BASE/projects/:projectSlug/items/:itemId/comments/:commentId" -H "$AUTH"
```

## Reactions

### POST /projects/:projectSlug/items/:itemId/comments/:commentId/reactions
Add an emoji reaction to a comment

```bash
curl -X POST "$BASE/projects/:projectSlug/items/:itemId/comments/:commentId/reactions" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "reaction": "string"
}'
```

### DELETE /projects/:projectSlug/items/:itemId/comments/:commentId/reactions/:reaction
Remove your emoji reaction from a comment

```bash
curl -X DELETE "$BASE/projects/:projectSlug/items/:itemId/comments/:commentId/reactions/:reaction" -H "$AUTH"
```

## Tags

### GET /projects/:projectSlug/tags
List project tags

```bash
curl -X GET "$BASE/projects/:projectSlug/tags" -H "$AUTH"
```

### POST /projects/:projectSlug/tags
Create a tag

```bash
curl -X POST "$BASE/projects/:projectSlug/tags" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "name": "string",
  "color": null
}'
```

### PATCH /projects/:projectSlug/tags/:id
Update a tag (partial)

```bash
curl -X PATCH "$BASE/projects/:projectSlug/tags/:id" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "name": "string",
  "color": null
}'
```

### DELETE /projects/:projectSlug/tags/:id
Delete a tag (admin only)

```bash
curl -X DELETE "$BASE/projects/:projectSlug/tags/:id" -H "$AUTH"
```

## attachments

### GET /projects/:projectSlug/items/:itemId/attachments
List attachments of an item

```bash
curl -X GET "$BASE/projects/:projectSlug/items/:itemId/attachments" -H "$AUTH"
```

### POST /projects/:projectSlug/items/:itemId/attachments
Upload a file attachment (MIME + magic-byte validated, 10 MB max)

```bash
curl -X POST "$BASE/projects/:projectSlug/items/:itemId/attachments" -H "$AUTH" -F "file=@data.csv"
```

### DELETE /projects/:projectSlug/items/:itemId/attachments/:id
Delete an attachment (shows a placeholder on the item)

```bash
curl -X DELETE "$BASE/projects/:projectSlug/items/:itemId/attachments/:id" -H "$AUTH"
```

## Relations

### GET /projects/:projectSlug/items/:itemId/relations
List relations of an item

```bash
curl -X GET "$BASE/projects/:projectSlug/items/:itemId/relations" -H "$AUTH"
```

### POST /projects/:projectSlug/items/:itemId/relations
Relate an item to another item in the same project

```bash
curl -X POST "$BASE/projects/:projectSlug/items/:itemId/relations" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "targetItemId": "00000000-0000-0000-0000-000000000001",
  "relationType": "blocks"
}'
```

### DELETE /projects/:projectSlug/items/:itemId/relations/:id
Delete a relation

```bash
curl -X DELETE "$BASE/projects/:projectSlug/items/:itemId/relations/:id" -H "$AUTH"
```

## Activities

### GET /projects/:projectSlug/activity?cursor=&limit=&actorId=&action=&itemId=&sort=&dateFrom=&dateTo=
Project activity timeline (cursor pagination, filters)

```bash
curl -X GET "$BASE/projects/:projectSlug/activity?cursor=&limit=&actorId=&action=&itemId=&sort=&dateFrom=&dateTo=" -H "$AUTH"
```

### GET /projects/:projectSlug/items/:itemId/activity?itemId=&cursor=&limit=&actorId=&action=&sort=&dateFrom=&dateTo=
Activity timeline of one item

```bash
curl -X GET "$BASE/projects/:projectSlug/items/:itemId/activity?itemId=&cursor=&limit=&actorId=&action=&sort=&dateFrom=&dateTo=" -H "$AUTH"
```

## Search

### GET /search?cursor=&limit=&q=&projectId=
Full-text search across accessible items

```bash
curl -X GET "$BASE/search?cursor=&limit=&q=&projectId=" -H "$AUTH"
```

## api-keys

### GET /api-keys
List my API keys (secret hashes never exposed)

```bash
curl -X GET "$BASE/api-keys" -H "$AUTH"
```

### POST /api-keys
Create an API key (secret returned once — store it)

```bash
curl -X POST "$BASE/api-keys" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "name": "string",
  "projectId": "00000000-0000-0000-0000-000000000001",
  "expiresAt": "2026-01-01T00:00:00.000Z",
  "rateLimitPerMin": 1
}'
```

### PATCH /api-keys/:id
Rename a key or change its budget (1–10000 req/min)

```bash
curl -X PATCH "$BASE/api-keys/:id" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "name": "string",
  "rateLimitPerMin": 1
}'
```

### DELETE /api-keys/:id
Revoke an API key immediately

```bash
curl -X DELETE "$BASE/api-keys/:id" -H "$AUTH"
```

## notifications

### GET /notifications?cursor=&limit=
List my notifications, newest first (cursor pagination)

```bash
curl -X GET "$BASE/notifications?cursor=&limit=" -H "$AUTH"
```

### GET /notifications/unread
List my unread notifications

```bash
curl -X GET "$BASE/notifications/unread" -H "$AUTH"
```

### GET /notifications/unread/count
Count my unread notifications (badge)

```bash
curl -X GET "$BASE/notifications/unread/count" -H "$AUTH"
```

### PATCH /notifications/:id/read
Mark one notification as read

```bash
curl -X PATCH "$BASE/notifications/:id/read" -H "$AUTH"
```

### PATCH /notifications/read-all
Mark all my notifications as read

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
curl -X PUT "$BASE/notifications/prefs/:projectSlug" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "muted": true,
  "emailDigest": true,
  "digestHour": 1
}'
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
Check whether the current user is a server admin

```bash
curl -X GET "$BASE/admin/check" -H "$AUTH"
```

### GET /admin/stats
Server-wide stats (users, projects, items)

```bash
curl -X GET "$BASE/admin/stats" -H "$AUTH"
```

### GET /admin/users
List all users (server admin)

```bash
curl -X GET "$BASE/admin/users" -H "$AUTH"
```

### PATCH /admin/users/:id/make-admin
Promote a user to server admin

```bash
curl -X PATCH "$BASE/admin/users/:id/make-admin" -H "$AUTH"
```

### PATCH /admin/users/:id/deactivate
Deactivate a user (they can no longer log in)

```bash
curl -X PATCH "$BASE/admin/users/:id/deactivate" -H "$AUTH"
```

### GET /admin/projects
List all projects (server admin)

```bash
curl -X GET "$BASE/admin/projects" -H "$AUTH"
```

### GET /admin/projects/:id/members
List members of any project (server admin)

```bash
curl -X GET "$BASE/admin/projects/:id/members" -H "$AUTH"
```

### PATCH /admin/projects/:id/members/:memberId/role
Change any membership role (server admin)

```bash
curl -X PATCH "$BASE/admin/projects/:id/members/:memberId/role" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "role": "string"
}'
```

### PATCH /admin/projects/:id/archive
Archive any project (server admin)

```bash
curl -X PATCH "$BASE/admin/projects/:id/archive" -H "$AUTH"
```

### DELETE /admin/projects/:id
Delete any project (server admin, irreversible)

```bash
curl -X DELETE "$BASE/admin/projects/:id" -H "$AUTH"
```

### GET /admin/activity?cursor=&limit=
Server-wide activity (server admin, cursor pagination)

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
curl -X POST "$BASE/projects/:projectSlug/webhooks" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "url": "string",
  "events": [
    "item.created"
  ]
}'
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
Update a webhook (URL, events, active flag)

```bash
curl -X PATCH "$BASE/projects/:projectSlug/webhooks/:id" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "url": "string",
  "events": [
    "item.created"
  ],
  "isActive": true
}'
```

### DELETE /projects/:projectSlug/webhooks/:id
Delete a webhook

```bash
curl -X DELETE "$BASE/projects/:projectSlug/webhooks/:id" -H "$AUTH"
```

