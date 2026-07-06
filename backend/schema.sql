-- CordLyx Database Schema
-- Generated from Drizzle ORM schema
-- Includes search_vector generated column (not representable by Drizzle)

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE users (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  username character varying(50),
  email character varying(255) NOT NULL,
  password_hash character varying(255) NOT NULL,
  name character varying(100) NOT NULL,
  avatar_url text,
  is_active boolean DEFAULT true NOT NULL,
  is_admin boolean DEFAULT false NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT users_username_unique UNIQUE (username),
  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

CREATE TABLE projects (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name character varying(200) NOT NULL,
  slug character varying(200) NOT NULL,
  description text,
  owner_id uuid NOT NULL,
  is_archived boolean DEFAULT false NOT NULL,
  settings jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT projects_slug_unique UNIQUE (slug),
  CONSTRAINT projects_pkey PRIMARY KEY (id)
);

CREATE TABLE project_members (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role character varying(20) DEFAULT 'member' NOT NULL,
  joined_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT project_members_project_id_user_id_unique UNIQUE (project_id, user_id),
  CONSTRAINT project_members_pkey PRIMARY KEY (id)
);

CREATE TABLE item_priorities (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL,
  name character varying(100) NOT NULL,
  color character varying(7),
  icon character varying(50),
  is_default boolean DEFAULT false NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT item_priorities_project_id_name_unique UNIQUE (project_id, name),
  CONSTRAINT item_priorities_pkey PRIMARY KEY (id)
);

CREATE TABLE item_statuses (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL,
  name character varying(100) NOT NULL,
  color character varying(7) NOT NULL,
  category character varying(20) NOT NULL,
  is_default boolean DEFAULT false NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT item_statuses_project_id_name_unique UNIQUE (project_id, name),
  CONSTRAINT item_statuses_pkey PRIMARY KEY (id)
);

CREATE TABLE item_types (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL,
  name character varying(100) NOT NULL,
  color character varying(7) NOT NULL,
  icon character varying(50),
  is_default boolean DEFAULT false NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT item_types_project_id_name_unique UNIQUE (project_id, name),
  CONSTRAINT item_types_pkey PRIMARY KEY (id)
);

CREATE TABLE items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL,
  sequence_num integer NOT NULL,
  type_id uuid NOT NULL,
  status_id uuid NOT NULL,
  priority_id uuid NOT NULL,
  assignee_id uuid,
  reporter_id uuid,
  parent_id uuid,
  plan_id uuid,
  roadmap_id uuid,
  title character varying(500) NOT NULL,
  description text,
  sort_order double precision DEFAULT 0 NOT NULL,
  due_date timestamp,
  start_date timestamp,
  estimated_hours numeric(6,1),
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))) STORED,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  deleted_at timestamp,
  CONSTRAINT items_project_id_sequence_num_unique UNIQUE (project_id, sequence_num),
  CONSTRAINT items_pkey PRIMARY KEY (id)
);

CREATE TABLE item_tags (
  item_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  CONSTRAINT item_tags_item_id_tag_id_pk PRIMARY KEY (item_id, tag_id)
);

CREATE TABLE tags (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL,
  name character varying(100) NOT NULL,
  color character varying(7),
  created_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT tags_project_id_name_unique UNIQUE (project_id, name),
  CONSTRAINT tags_pkey PRIMARY KEY (id)
);

CREATE TABLE comments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  item_id uuid NOT NULL,
  author_id uuid NOT NULL,
  parent_id uuid,
  body text NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  deleted_at timestamp,
  CONSTRAINT comments_pkey PRIMARY KEY (id)
);

CREATE TABLE attachments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  item_id uuid NOT NULL,
  comment_id uuid,
  uploader_id uuid NOT NULL,
  filename character varying(255) NOT NULL,
  original_filename character varying(255) NOT NULL,
  mime_type character varying(127) NOT NULL,
  size_bytes integer NOT NULL,
  storage_path text NOT NULL,
  storage_provider character varying(50) DEFAULT 'local' NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  deleted_at timestamp,
  CONSTRAINT attachments_pkey PRIMARY KEY (id)
);

CREATE TABLE item_relations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  source_item_id uuid NOT NULL,
  target_item_id uuid NOT NULL,
  relation_type character varying(20) NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT item_relations_source_item_id_target_item_id_relation_type_unique UNIQUE (source_item_id, target_item_id, relation_type),
  CONSTRAINT item_relations_pkey PRIMARY KEY (id)
);

CREATE TABLE activities (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  item_id uuid,
  action character varying(50) NOT NULL,
  field_name character varying(100),
  old_value jsonb,
  new_value jsonb,
  metadata jsonb,
  created_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT activities_pkey PRIMARY KEY (id)
);

CREATE TABLE plans (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL,
  name character varying(200) NOT NULL,
  description text,
  type character varying(20) NOT NULL,
  status character varying(20) DEFAULT 'active' NOT NULL,
  color character varying(7),
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT plans_pkey PRIMARY KEY (id)
);

CREATE TABLE issue_sequences (
  project_id uuid NOT NULL,
  last_value bigint DEFAULT 0 NOT NULL,
  CONSTRAINT issue_sequences_pkey PRIMARY KEY (project_id)
);

CREATE TABLE api_keys (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  project_id uuid,
  name character varying(100) NOT NULL,
  key_hash character varying(64) NOT NULL,
  key_prefix character varying(12) NOT NULL,
  expires_at timestamp,
  last_used_at timestamp,
  created_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT api_keys_key_hash_unique UNIQUE (key_hash),
  CONSTRAINT api_keys_pkey PRIMARY KEY (id)
);

CREATE TABLE notifications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  project_id uuid NOT NULL,
  item_id uuid,
  type character varying(50) NOT NULL,
  data jsonb DEFAULT '{}'::jsonb NOT NULL,
  read_at timestamp,
  created_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

CREATE TABLE comment_reactions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  comment_id uuid NOT NULL,
  user_id uuid NOT NULL,
  reaction character varying(20) NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT comment_reactions_comment_id_user_id_reaction_unique UNIQUE (comment_id, user_id, reaction),
  CONSTRAINT comment_reactions_pkey PRIMARY KEY (id)
);

CREATE TABLE item_votes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  item_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT item_votes_item_id_user_id_unique UNIQUE (item_id, user_id),
  CONSTRAINT item_votes_pkey PRIMARY KEY (id)
);

CREATE TABLE roadmaps (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL,
  name character varying(200) NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  color character varying(7),
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT roadmaps_pkey PRIMARY KEY (id)
);

CREATE TABLE roadmap_lanes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  roadmap_id uuid NOT NULL,
  name character varying(200) NOT NULL,
  icon character varying(10),
  color character varying(7),
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT roadmap_lanes_pkey PRIMARY KEY (id)
);

CREATE TABLE roadmap_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  roadmap_id uuid NOT NULL,
  item_id uuid NOT NULL,
  lane_id uuid,
  start_date timestamp,
  due_date timestamp,
  sort_order double precision DEFAULT 0 NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT roadmap_items_roadmap_id_item_id_unique UNIQUE (roadmap_id, item_id),
  CONSTRAINT roadmap_items_pkey PRIMARY KEY (id)
);

CREATE TABLE invites (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL,
  token character varying(64) NOT NULL,
  created_by_id uuid NOT NULL,
  role character varying(20) DEFAULT 'member' NOT NULL,
  expires_at timestamp NOT NULL,
  used_at timestamp,
  created_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT invites_token_unique UNIQUE (token),
  CONSTRAINT invites_pkey PRIMARY KEY (id)
);

CREATE TABLE webhooks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL,
  url character varying(2048) NOT NULL,
  events jsonb NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT webhooks_pkey PRIMARY KEY (id)
);

-- Foreign keys

ALTER TABLE projects ADD CONSTRAINT projects_owner_id_users_id_fk FOREIGN KEY (owner_id) REFERENCES users(id);
ALTER TABLE project_members ADD CONSTRAINT project_members_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE project_members ADD CONSTRAINT project_members_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE item_priorities ADD CONSTRAINT item_priorities_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE item_statuses ADD CONSTRAINT item_statuses_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE item_types ADD CONSTRAINT item_types_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE items ADD CONSTRAINT items_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE items ADD CONSTRAINT items_type_id_item_types_id_fk FOREIGN KEY (type_id) REFERENCES item_types(id);
ALTER TABLE items ADD CONSTRAINT items_status_id_item_statuses_id_fk FOREIGN KEY (status_id) REFERENCES item_statuses(id);
ALTER TABLE items ADD CONSTRAINT items_priority_id_item_priorities_id_fk FOREIGN KEY (priority_id) REFERENCES item_priorities(id);
ALTER TABLE items ADD CONSTRAINT items_assignee_id_users_id_fk FOREIGN KEY (assignee_id) REFERENCES users(id);
ALTER TABLE items ADD CONSTRAINT items_reporter_id_users_id_fk FOREIGN KEY (reporter_id) REFERENCES users(id);
ALTER TABLE items ADD CONSTRAINT items_plan_id_plans_id_fk FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE SET NULL;
ALTER TABLE items ADD CONSTRAINT items_roadmap_id_roadmaps_id_fk FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE SET NULL;
ALTER TABLE item_tags ADD CONSTRAINT item_tags_item_id_items_id_fk FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE;
ALTER TABLE item_tags ADD CONSTRAINT item_tags_tag_id_tags_id_fk FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE;
ALTER TABLE tags ADD CONSTRAINT tags_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE comments ADD CONSTRAINT comments_item_id_items_id_fk FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE;
ALTER TABLE comments ADD CONSTRAINT comments_author_id_users_id_fk FOREIGN KEY (author_id) REFERENCES users(id);
ALTER TABLE attachments ADD CONSTRAINT attachments_item_id_items_id_fk FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE;
ALTER TABLE attachments ADD CONSTRAINT attachments_comment_id_comments_id_fk FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE SET NULL;
ALTER TABLE attachments ADD CONSTRAINT attachments_uploader_id_users_id_fk FOREIGN KEY (uploader_id) REFERENCES users(id);
ALTER TABLE item_relations ADD CONSTRAINT item_relations_source_item_id_items_id_fk FOREIGN KEY (source_item_id) REFERENCES items(id) ON DELETE CASCADE;
ALTER TABLE item_relations ADD CONSTRAINT item_relations_target_item_id_items_id_fk FOREIGN KEY (target_item_id) REFERENCES items(id) ON DELETE CASCADE;
ALTER TABLE activities ADD CONSTRAINT activities_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE activities ADD CONSTRAINT activities_actor_id_users_id_fk FOREIGN KEY (actor_id) REFERENCES users(id);
ALTER TABLE activities ADD CONSTRAINT activities_item_id_items_id_fk FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL;
ALTER TABLE plans ADD CONSTRAINT plans_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE issue_sequences ADD CONSTRAINT issue_sequences_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE api_keys ADD CONSTRAINT api_keys_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE api_keys ADD CONSTRAINT api_keys_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD CONSTRAINT notifications_actor_id_users_id_fk FOREIGN KEY (actor_id) REFERENCES users(id);
ALTER TABLE notifications ADD CONSTRAINT notifications_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD CONSTRAINT notifications_item_id_items_id_fk FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL;
ALTER TABLE comment_reactions ADD CONSTRAINT comment_reactions_comment_id_comments_id_fk FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE;
ALTER TABLE comment_reactions ADD CONSTRAINT comment_reactions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE item_votes ADD CONSTRAINT item_votes_item_id_items_id_fk FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE;
ALTER TABLE item_votes ADD CONSTRAINT item_votes_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE roadmaps ADD CONSTRAINT roadmaps_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE roadmap_lanes ADD CONSTRAINT roadmap_lanes_roadmap_id_roadmaps_id_fk FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE;
ALTER TABLE roadmap_items ADD CONSTRAINT roadmap_items_roadmap_id_roadmaps_id_fk FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE;
ALTER TABLE roadmap_items ADD CONSTRAINT roadmap_items_item_id_items_id_fk FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE;
ALTER TABLE roadmap_items ADD CONSTRAINT roadmap_items_lane_id_roadmap_lanes_id_fk FOREIGN KEY (lane_id) REFERENCES roadmap_lanes(id) ON DELETE SET NULL;
ALTER TABLE invites ADD CONSTRAINT invites_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES projects(id);
ALTER TABLE invites ADD CONSTRAINT invites_created_by_id_users_id_fk FOREIGN KEY (created_by_id) REFERENCES users(id);
ALTER TABLE webhooks ADD CONSTRAINT webhooks_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES projects(id);

-- Indexes

CREATE INDEX idx_items_status_sort ON items USING btree (status_id, sort_order);
CREATE INDEX idx_items_project_created ON items USING btree (project_id, created_at);
CREATE INDEX idx_comments_item ON comments USING btree (item_id);
CREATE INDEX idx_comments_parent ON comments USING btree (parent_id);
CREATE INDEX idx_attachments_item_created ON attachments USING btree (item_id, created_at);
CREATE INDEX idx_plans_project ON plans USING btree (project_id, sort_order);
CREATE INDEX idx_notifications_user_created ON notifications USING btree (user_id, created_at);
CREATE INDEX idx_notifications_unread ON notifications USING btree (user_id, read_at);
CREATE INDEX idx_roadmaps_project ON roadmaps USING btree (project_id, sort_order);
CREATE INDEX idx_lanes_roadmap_sort ON roadmap_lanes USING btree (roadmap_id, sort_order);
CREATE INDEX idx_items_search ON items USING gin (search_vector);
