-- CordLyx Database Schema

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         varchar(255) NOT NULL,
  password_hash varchar(255) NOT NULL,
  name          varchar(100) NOT NULL,
  avatar_url    text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamp with time zone NOT NULL DEFAULT now(),
  updated_at    timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE TABLE IF NOT EXISTS projects (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          varchar(200) NOT NULL,
  slug          varchar(200) NOT NULL,
  description   text,
  owner_id      uuid NOT NULL REFERENCES users(id),
  is_archived   boolean NOT NULL DEFAULT false,
  settings      jsonb NOT NULL DEFAULT '{}',
  created_at    timestamp with time zone NOT NULL DEFAULT now(),
  updated_at    timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_slug ON projects (slug);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects (owner_id);

CREATE TABLE IF NOT EXISTS project_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        varchar(20) NOT NULL DEFAULT 'member',
  joined_at   timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members (project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members (user_id);

CREATE TABLE IF NOT EXISTS item_types (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        varchar(100) NOT NULL,
  color       varchar(7) NOT NULL,
  icon        varchar(50),
  is_default  boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  updated_at  timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(project_id, name)
);
CREATE INDEX IF NOT EXISTS idx_item_types_project ON item_types (project_id);

CREATE TABLE IF NOT EXISTS item_statuses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        varchar(100) NOT NULL,
  color       varchar(7) NOT NULL,
  category    varchar(20) NOT NULL DEFAULT 'todo',
  is_default  boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  updated_at  timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(project_id, name)
);
CREATE INDEX IF NOT EXISTS idx_item_statuses_project ON item_statuses (project_id);

CREATE TABLE IF NOT EXISTS item_priorities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        varchar(100) NOT NULL,
  color       varchar(7),
  icon        varchar(50),
  is_default  boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  updated_at  timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(project_id, name)
);
CREATE INDEX IF NOT EXISTS idx_item_priorities_project ON item_priorities (project_id);

CREATE TABLE IF NOT EXISTS items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sequence_num    integer NOT NULL,
  type_id         uuid NOT NULL REFERENCES item_types(id),
  status_id       uuid NOT NULL REFERENCES item_statuses(id),
  priority_id     uuid NOT NULL REFERENCES item_priorities(id),
  assignee_id     uuid REFERENCES users(id),
  reporter_id     uuid REFERENCES users(id),
  parent_id       uuid REFERENCES items(id),
  title           varchar(500) NOT NULL,
  description     text,
  sort_order      double precision NOT NULL DEFAULT 0,
  due_date        timestamp with time zone,
  estimated_hours numeric(6,1),
  search_vector   tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) STORED,
  created_at      timestamp with time zone NOT NULL DEFAULT now(),
  updated_at      timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at      timestamp with time zone
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_items_project_sequence ON items (project_id, sequence_num);
CREATE INDEX IF NOT EXISTS idx_items_project_status ON items (project_id, status_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_items_project_assignee ON items (project_id, assignee_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_items_project_created ON items (project_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_items_project_updated ON items (project_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_items_parent ON items (parent_id);
CREATE INDEX IF NOT EXISTS idx_items_search ON items USING GIN (search_vector);

CREATE TABLE IF NOT EXISTS issue_sequences (
  project_id  uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  last_value  bigint NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        varchar(100) NOT NULL,
  color       varchar(7),
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(project_id, name)
);
CREATE INDEX IF NOT EXISTS idx_tags_project ON tags (project_id);

CREATE TABLE IF NOT EXISTS item_tags (
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  tag_id  uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_item_tags_tag ON item_tags (tag_id);

CREATE TABLE IF NOT EXISTS comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES users(id),
  parent_id   uuid REFERENCES comments(id),
  body        text NOT NULL,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  updated_at  timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at  timestamp with time zone
);
CREATE INDEX IF NOT EXISTS idx_comments_item ON comments (item_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments (parent_id);

CREATE TABLE IF NOT EXISTS attachments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id           uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  comment_id        uuid REFERENCES comments(id) ON DELETE SET NULL,
  uploader_id       uuid NOT NULL REFERENCES users(id),
  filename          varchar(255) NOT NULL,
  original_filename varchar(255) NOT NULL,
  mime_type         varchar(127) NOT NULL,
  size_bytes        integer NOT NULL,
  storage_path      text NOT NULL,
  storage_provider  varchar(50) NOT NULL DEFAULT 'local',
  created_at        timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at        timestamp with time zone
);
CREATE INDEX IF NOT EXISTS idx_attachments_item ON attachments (item_id);
CREATE INDEX IF NOT EXISTS idx_attachments_comment ON attachments (comment_id);

CREATE TABLE IF NOT EXISTS item_relations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_item_id  uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  target_item_id  uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  relation_type   varchar(20) NOT NULL,
  created_at      timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(source_item_id, target_item_id, relation_type)
);
CREATE INDEX IF NOT EXISTS idx_item_relations_source ON item_relations (source_item_id);
CREATE INDEX IF NOT EXISTS idx_item_relations_target ON item_relations (target_item_id);

CREATE TABLE IF NOT EXISTS activities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  actor_id    uuid NOT NULL REFERENCES users(id),
  item_id     uuid REFERENCES items(id) ON DELETE SET NULL,
  action      varchar(50) NOT NULL,
  field_name  varchar(100),
  old_value   jsonb,
  new_value   jsonb,
  metadata    jsonb,
  created_at  timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activities_project ON activities (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_item ON activities (item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_actor ON activities (actor_id, created_at DESC);
