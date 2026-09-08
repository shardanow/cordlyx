-- 0009: per-project notification prefs (E3: mute + email digest).
-- Idempotent: safe to re-run.
CREATE TABLE IF NOT EXISTS notification_prefs (
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  muted boolean DEFAULT false NOT NULL,
  email_digest boolean DEFAULT false NOT NULL,
  digest_hour integer DEFAULT 8 NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT notification_prefs_user_id_project_id_unique UNIQUE (user_id, project_id)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_prefs_user_id_users_id_fk') THEN
    ALTER TABLE notification_prefs
      ADD CONSTRAINT notification_prefs_user_id_users_id_fk
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_prefs_project_id_projects_id_fk') THEN
    ALTER TABLE notification_prefs
      ADD CONSTRAINT notification_prefs_project_id_projects_id_fk
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  END IF;
END
$$;
