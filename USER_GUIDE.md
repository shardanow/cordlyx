# CordLyx User Guide

## Contents

1. [Getting Started](#getting-started)
2. [Projects](#projects)
3. [Items (Issues / Tickets)](#items-issues--tickets)
4. [Board View (Kanban)](#board-view-kanban)
5. [Plans](#plans)
6. [Roadmaps (Gantt)](#roadmaps-gantt)
7. [Comments & @Mentions](#comments--mentions)
8. [Attachments](#attachments)
9. [Relations](#relations)
10. [Search](#search)
11. [Notifications](#notifications)
12. [Team Members & Roles](#team-members--roles)
13. [Invite Links](#invite-links)
14. [Export](#export)
15. [API Keys](#api-keys)
16. [Keyboard Shortcuts](#keyboard-shortcuts)
17. [Profile & Account](#profile--account)
18. [Admin Panel](#admin-panel)
19. [Webhooks](#webhooks)
20. [Project Settings](#project-settings)
21. [Behind the Scenes](#behind-the-scenes)
22. [Demo Data](#demo-data)

---

## Getting Started

### Registration

1. Open the app in your browser (default: `http://localhost:3000`)
2. Click **"Don't have an account? Sign up"**
3. Fill in your name, email, and password (minimum 8 characters)
4. Click **Sign up**

You are automatically logged in and redirected to the projects page.

### Login

1. Enter your email and password
2. Click **Sign in**

If you ever get logged out, the app will try to refresh your session automatically. When that fails, you are redirected to the login page.

### Logout

Click **Sign out** in the sidebar on any dashboard page.

---

## Projects

### Creating a project

1. On the Projects page, click **New Project**
2. Enter a project name
3. Click **Create**

A project slug is auto-generated from the name (e.g. "My Project" → `my-project`). The project comes pre-configured with:
- **10 item types:** Task, Bug, Feature, Idea, Improvement, Epic, Note, Decision, Research, Document
- **7 statuses:** Inbox, Backlog, To Do, In Progress, In Review, Done, Cancelled
- **4 priorities:** Critical, High, Medium, Low

### Viewing projects

All your projects are shown as cards on the Projects page. Click a card to enter that project.

### Editing a project

Open a project and go to the **Settings** tab. Here you can:
- Edit the project name, slug, and description
- Configure **item types** (create, edit, delete)
- Configure **statuses** (create, edit, delete)
- Configure **priorities** (create, edit, delete)
- Manage **tags** (create, edit, delete)
- Configure **webhooks**

Only admins can access project settings.

### Deleting a project

Click **Delete project** in the Settings page. Only the project admin can delete a project.

---

## Items (Issues / Tickets)

Items are the core unit of work in CordLyx. Each item belongs to a project and has a unique sequence number within that project (e.g. `#1`, `#2`).

### Item fields

| Field | Description |
|-------|-------------|
| **ID** | Auto-incrementing sequence per project (`PROJECT-1`, `PROJECT-2`, ...) |
| **Title** | Required, up to 500 characters |
| **Type** | Task, Bug, Feature, etc. (configurable per project) |
| **Status** | Inbox, Backlog, To Do, etc. (configurable per project) |
| **Priority** | Critical, High, Medium, Low (configurable per project) |
| **Assignee** | Team member responsible for the item |
| **Description** | Rich-text (WYSIWYG) with tables, images, mentions |
| **Due date** | Deadline for the item |
| **Estimated hours** | Time estimate in hours |
| **Tags** | Label items for filtering |
| **Plan** | Group items under a release/milestone/goal |
| **Relations** | Link items (blocks, depends on, relates to, etc.) |

### Creating an item

Press **Cmd+K** (Mac) or **Ctrl+K** (Windows/Linux) to open Quick create from anywhere in the app, or click **Quick create** in the sidebar:
1. Select a project
2. Enter a title
3. Choose a type
4. Click **Create** — you are redirected to the new item's detail page

The item is automatically assigned the default status (Inbox) and default priority (Medium).

### Creating from board view

On the **Board** tab, click **Create item** button. Fill in the title and type, optionally select a plan. The item appears in the default status column.

### Item detail page

Click an item's title or sequence number to open its detail page. Here you can:
- Edit all item fields inline (type, status, priority, assignee, plan, dates)
- Manage tags (toggle on/off, create new)
- View the **Activity timeline** — all events for this item (status changes, assignments, comments)
- Read and write comments (with `@mention` support, emoji reactions)
- Upload and view attachments (paste images from clipboard)
- Create and view item relations
- Vote on items (upvote)

### Inline editing on list view

Hover over an item row to reveal quick edit controls for status, priority, and assignee. Changes are saved immediately.

### Saved views

The List tab supports saved filter combinations. Configure filters (type, status, priority, assignee, plan, search), then save the view by name. Saved views persist across browser sessions.

### Pagination

Items list uses cursor-based pagination. Use prev/next buttons at the bottom to navigate between pages.

---

## Board View (Kanban)

The **Board** tab shows items grouped by status as columns.

### Drag and drop

- **Drag** an item card to another column to change its status
- The status change is saved immediately — no manual save needed
- A floating card preview appears during drag

---

## Plans

Plans allow grouping items into releases, milestones, campaigns, or goals.

### Creating a plan

1. Go to the **Plans** tab in a project
2. Click **Create plan**
3. Enter a name, select type (release/milestone/campaign/goal/custom), status, and color
4. Click **Create**

### Using plans

- Plans appear as a filter on the items list page and board view
- On the item detail page, select a plan from the dropdown
- Plans can be edited or deleted from the Plans tab

---

## Roadmaps (Gantt)

Roadmaps provide an interactive timeline view for scheduling items.

### Creating a roadmap

1. Go to the **Roadmaps** tab in a project
2. Click **Create roadmap**
3. Set a name, date range, and color
4. Click **Create**

### Using the timeline editor

- **Unscheduled items** are shown in a sidebar — drag them onto the timeline
- **Lanes** group items (create, rename, reorder)
- **Item bars** can be dragged to change dates, resized from the right edge
- **Dependency arrows** show relations between scheduled items
- Time modes: day, week, month, quarter
- Fullscreen mode available

### Lanes

Each roadmap can have multiple lanes (swimlanes). Create, edit, reorder, and delete lanes from the timeline editor.

---

## Comments & @Mentions

On the item detail page, scroll down to the **Comments** section:
- **Add a comment** — rich text editor with bold, italic, lists, code blocks, tables
- **Edit your comment** — click "Edit" to modify it inline
- **Delete your comment** — click "Delete" to remove it
- **@mention** a team member: type `@name` to notify them
- **Reactions** — add emoji reactions to any comment
- **Replies** — reply to a specific comment (threaded)

When you @mention someone, they receive a notification (see [Notifications](#notifications)).

---

## Attachments

On the item detail page, the **Attachments** section lets you upload files:
- Click **Attach file** and select a file (max 10 MB)
- Supported: images (JPEG, PNG, GIF, WebP, SVG), PDF, text, CSV, JSON, ZIP
- Uploaded files include the original filename, size, uploader name, and a download link
- **Paste images** from clipboard directly into the rich text editor
- Click **Delete** to remove an attachment (members only) — all references are replaced with "[deleted image]"

---

## Relations

Link items together to track dependencies:

| Relation type | Meaning |
|---------------|---------|
| **Blocks** | This item prevents another from proceeding |
| **Depends on** | This item requires another to be done first |
| **Relates to** | General connection |
| **Duplicates** | This item is a duplicate of another |
| **Child of** | This item is a sub-task of another |

On the item detail page, use the **Relations** section to add or remove links. You can only link items within the same project.

---

## Search

Press **`/`** anywhere in the app (not inside a text input) to open the global search modal.

- Type your query — results appear after a short debounce
- Results show the matching item title, project slug, and creation date
- Navigate with arrow keys, press **Enter** to open the item
- Press **Escape** to close

Search uses PostgreSQL full-text indexing (`tsvector` + GIN) on item titles and descriptions.

---

## Notifications

The **Notifications** button in the sidebar shows a red badge when you have unread notifications. Click to see recent notifications as a dropdown, or click "View all" to open the full **Notifications** page at `/notifications`.

**You receive notifications when:**
- Someone **@mentions** you in a comment (e.g. `@alice`)
- You are **assigned** to an item

**What you can do:**
- Click a notification to open the related item and mark it as read
- Click **Mark all read** to clear all
- Filter by **Unread** / **All** on the notifications page
- The badge count updates every 30 seconds

---

## Team Members & Roles

Each project has members with one of three roles:

| Role | Permissions |
|------|-------------|
| **Admin** | Full control: create/edit items, manage members, configure types/statuses/priorities/tags/webhooks |
| **Member** | Create and edit items, add comments and attachments |
| **Viewer** | Read-only access to the project |

The project creator is automatically an admin.

Manage members via the **Members** tab in a project. Admins can add members by searching their name or email, change roles, or remove members.

---

## Invite Links

Admins can generate shareable invite links from the **Members** page:

1. Click **Generate** in the "Invite link" section
2. A unique link is created (e.g. `https://your-domain/invite/abc123...`)
3. Share the link with anyone — when they open it, they can accept and join the project
4. Invite links expire after 7 days and can only be used once

The invitee must have an account. On the invite page, they click **Accept invitation** to join as a member.

---

## Export

On the items list page, click **Export CSV** to download all items (including soft-deleted items are excluded) as a CSV file. The file can be opened in any spreadsheet application.

---

## API Keys

API keys allow scripts, CI/CD pipelines, and integrations to authenticate without a password.

### Creating an API key

1. Go to **Profile** (sidebar)
2. Scroll down to **API Keys**
3. Enter a name for the key (e.g. "CI/CD", "Deploy script")
4. Click **Generate**
5. **Copy the key immediately** — it is shown only once

### Using an API key

Add the `X-API-Key` header to any request:

```bash
curl -H "X-API-Key: clx_..." https://your-domain/api/v1/projects
```

### Revoking a key

Click **Revoke** next to any existing key. The key is deleted immediately and cannot be used again.

### Security notes

- Each key starts with `clx_` and is 36+ characters long
- Only the SHA-256 hash is stored — the original key is never retrievable after creation
- Keys can be scoped to a specific project (via API)
- Keys support expiry dates (via API)

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Cmd/Ctrl + K** | Open Quick create modal |
| **/** | Open global search (when not in an input) |
| **?** | Show keyboard shortcuts reference |
| **Escape** | Close any open modal |

Press **?** in the app to see the full reference panel.

---

## Profile & Account

Your profile is accessible via the sidebar (your name/avatar at the bottom).

### Editing profile

- Change your display name
- Set an avatar URL (image URL, not file upload)
- Changes are saved immediately

### Change password

Enter your current password and a new password (min 8 characters). Click **Change Password** to update.

### Delete account

Type `delete me` to confirm, then click **Delete my account**. This deactivates your account — you will lose access to all projects. This action cannot be undone.

---

## Admin Panel

If your email is configured as an admin (via `ADMIN_EMAILS` environment variable), the **Admin** link appears in the sidebar.

The admin page at `/admin` shows:
- **Users tab** — list of all users (name, email, status, creation date). Admins can deactivate users.
- **Projects tab** — list of all projects (name, slug, status, creation date).

---

## Webhooks

Admins can configure webhooks in **Settings → Webhooks**.

When events occur in the project (item created/updated/deleted, comment added/removed, attachment added/removed), CordLyx sends an HTTP POST request to the configured URL with a JSON payload describing the event.

To add a webhook:
1. Go to **Settings**
2. Scroll to **Webhooks**
3. Enter the target URL
4. Select which events to listen for (leave empty for all)
5. Click **Add webhook**

---

## Project Settings

Only project admins can access settings (via the **Settings** tab in the sidebar). Settings include:

- **Project Details** — name, slug, description
- **Item Types** — create, edit, delete types (with color and icon)
- **Statuses** — create, edit, delete statuses (with color and category)
- **Priorities** — create, edit, delete priorities (with color)
- **Tags** — create, edit, delete tags (with color)
- **Webhooks** — manage outgoing webhook URLs

---

## Behind the Scenes

### Activity logging

All significant actions (item created, status changed, comment added, file uploaded) are logged asynchronously via BullMQ. The activity timeline on each item shows who did what and when, without slowing down the main request.

### Real-time updates

Changes by other team members are broadcast via WebSocket (Socket.IO). The page auto-refreshes when items, comments, or attachments change — no manual reload needed.

### Caching

Project config (types, statuses, priorities) and membership roles are cached in Redis for 30–60 minutes. Cache is invalidated automatically on changes.

---

## Demo Data

When you run `./dev.sh reset`, the following demo data is created:

**Users:**
| Email | Password | Role |
|-------|----------|------|
| `alice@example.com` | `password123` | Admin |
| `bob@example.com` | `password123` | Member |

**Project:** "Demo Project"

**Sample items:**
| # | Title | Type | Status | Priority | Assignee |
|---|-------|------|--------|----------|----------|
| 1 | Set up CI/CD pipeline | Task | To Do | Medium | Alice |
| 2 | Login page is broken on mobile | Bug | In Progress | Critical | Bob |
| 3 | Add dark mode support | Feature | Done | Medium | Alice |

**Tags:** `frontend` (blue), `backend` (green), `urgent` (red)

---

## What's Implemented

| Feature | Status |
|---------|--------|
| Authentication (register/login/refresh) | ✅ |
| User profile (name/avatar) | ✅ |
| Change password | ✅ |
| Delete account | ✅ |
| Projects (CRUD, soft-delete) | ✅ |
| Items (CRUD, pagination, filters, saved views, inline edit) | ✅ |
| Board view (Kanban) with drag & drop | ✅ |
| Plans (CRUD) | ✅ |
| Roadmaps (interactive Gantt editor with lanes, drag scheduling) | ✅ |
| Comments with @mentions, reactions, threading | ✅ |
| Tags (CRUD, toggle on items) | ✅ |
| Attachments (upload/download/delete, clipboard paste) | ✅ |
| Relations (blocks/depends on/relates to/duplicates/child of) | ✅ |
| Full-text search | ✅ |
| Activity timeline (per project + per item) | ✅ |
| Real-time WebSocket updates | ✅ |
| Notifications (@mention, assigned) with dropdown + full page | ✅ |
| API Keys for integrations | ✅ |
| Invite links | ✅ |
| Export to CSV | ✅ |
| Webhooks | ✅ |
| Admin panel (users/projects list, deactivate users) | ✅ |
| Dark mode | ✅ |
| Keyboard shortcuts | ✅ |
| Redis caching (membership, config) | ✅ |
| Health endpoint (`GET /health`) | ✅ |
