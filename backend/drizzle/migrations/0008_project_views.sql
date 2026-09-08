-- 0008: server-side saved views (E2: personal + shared + project default).
-- Idempotent: safe to re-run.
CREATE TABLE IF NOT EXISTS project_views (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  name character varying(100) NOT NULL,
  filters jsonb NOT NULL,
  is_shared boolean DEFAULT false NOT NULL,
  is_default boolean DEFAULT false NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT project_views_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_project_views_project ON project_views (project_id, created_at);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_views_project_id_projects_id_fk') THEN
    ALTER TABLE project_views
      ADD CONSTRAINT project_views_project_id_projects_id_fk
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_views_owner_id_users_id_fk') THEN
    ALTER TABLE project_views
      ADD CONSTRAINT project_views_owner_id_users_id_fk
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END
$$;
