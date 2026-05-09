-- ============================================================
-- Omni-Builder — Migração SQL COMPLETA para Supabase
-- Execute ESTE ARQUIVO INTEIRO no SQL Editor do Supabase
-- Inclui: projects, profiles, Omni DB, deploy previews, gallery,
--         recently_viewed, last_deploy, e todas as atualizações
-- ============================================================

-- ==========================================
-- 0. Helper function: auto-update updated_at
-- ==========================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ==========================================
-- 1. Profiles table (user info)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL DEFAULT '',
  display_name TEXT,
  avatar_url TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==========================================
-- 2. Projects table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled Project',
  description TEXT NOT NULL DEFAULT '',
  logo TEXT NOT NULL DEFAULT '',
  custom_rules TEXT NOT NULL DEFAULT '',
  preview_mode TEXT NOT NULL DEFAULT 'webcontainer',
  provider TEXT NOT NULL DEFAULT 'anthropic',
  model TEXT NOT NULL DEFAULT 'claude-3-5-sonnet-20240620',
  env_vars JSONB NOT NULL DEFAULT '[]'::jsonb,
  github_token TEXT NOT NULL DEFAULT '',
  github_repo TEXT NOT NULL DEFAULT '',
  github_branch TEXT NOT NULL DEFAULT 'main',
  netlify_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  vercel_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  cloudrun_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  database_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  google_drive_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_deploy JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add columns if table already exists (safe ALTER)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS custom_rules TEXT NOT NULL DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS preview_mode TEXT NOT NULL DEFAULT 'webcontainer';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS netlify_config JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS vercel_config JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS cloudrun_config JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS database_config JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS google_drive_config JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS last_deploy JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_select_own" ON public.projects
  FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "projects_insert_own" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "projects_update_own" ON public.projects
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "projects_delete_own" ON public.projects
  FOR DELETE USING (auth.uid() = owner_id);

CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_projects_owner ON public.projects(owner_id);

-- ==========================================
-- 3. Omni DB — Built-in Database (100MB per project)
-- ==========================================

-- Table: Collection schemas
CREATE TABLE IF NOT EXISTS public.app_db_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  collection_name TEXT NOT NULL,
  schema_def JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, collection_name)
);

-- Table: Collection data (documents)
CREATE TABLE IF NOT EXISTS public.app_db_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  collection_name TEXT NOT NULL,
  row_id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: Quota tracking (100MB = 104857600 bytes)
CREATE TABLE IF NOT EXISTS public.app_db_quota (
  project_id UUID PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  used_bytes BIGINT NOT NULL DEFAULT 0,
  max_bytes BIGINT NOT NULL DEFAULT 104857600,
  row_count BIGINT NOT NULL DEFAULT 0,
  collection_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_app_db_schemas_project ON public.app_db_schemas(project_id);
CREATE INDEX IF NOT EXISTS idx_app_db_data_project ON public.app_db_data(project_id);
CREATE INDEX IF NOT EXISTS idx_app_db_data_collection ON public.app_db_data(project_id, collection_name);
CREATE INDEX IF NOT EXISTS idx_app_db_data_row_id ON public.app_db_data(project_id, collection_name, row_id);

-- RLS
ALTER TABLE public.app_db_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_db_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_db_quota ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only project owners can access their data
CREATE POLICY "db_schemas_select_own" ON public.app_db_schemas
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "db_schemas_insert_own" ON public.app_db_schemas
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "db_schemas_update_own" ON public.app_db_schemas
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "db_schemas_delete_own" ON public.app_db_schemas
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));

CREATE POLICY "db_data_select_own" ON public.app_db_data
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "db_data_insert_own" ON public.app_db_data
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "db_data_update_own" ON public.app_db_data
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "db_data_delete_own" ON public.app_db_data
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));

CREATE POLICY "db_quota_select_own" ON public.app_db_quota
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "db_quota_insert_own" ON public.app_db_quota
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "db_quota_update_own" ON public.app_db_quota
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));

-- Triggers: auto-update updated_at
CREATE TRIGGER set_app_db_schemas_updated_at
  BEFORE UPDATE ON public.app_db_schemas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_app_db_data_updated_at
  BEFORE UPDATE ON public.app_db_data
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_app_db_quota_updated_at
  BEFORE UPDATE ON public.app_db_quota
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Function: auto-update quota when data changes
CREATE OR REPLACE FUNCTION public.update_db_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_project_id UUID;
  v_data_size BIGINT;
  v_row_count BIGINT;
  v_collection_count INT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_project_id := OLD.project_id;
  ELSE
    v_project_id := NEW.project_id;
  END IF;

  SELECT COALESCE(SUM(pg_column_size(data)), 0) INTO v_data_size
  FROM public.app_db_data WHERE project_id = v_project_id;

  SELECT COUNT(*) INTO v_row_count
  FROM public.app_db_data WHERE project_id = v_project_id;

  SELECT COUNT(*) INTO v_collection_count
  FROM public.app_db_schemas WHERE project_id = v_project_id;

  INSERT INTO public.app_db_quota (project_id, used_bytes, max_bytes, row_count, collection_count, updated_at)
  VALUES (v_project_id, v_data_size, 104857600, v_row_count, v_collection_count, NOW())
  ON CONFLICT (project_id) DO UPDATE
  SET used_bytes = v_data_size,
      row_count = v_row_count,
      collection_count = v_collection_count,
      updated_at = NOW();

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- Triggers: auto-update quota
CREATE TRIGGER trigger_db_data_quota_insert
  AFTER INSERT ON public.app_db_data
  FOR EACH ROW EXECUTE FUNCTION public.update_db_quota();
CREATE TRIGGER trigger_db_data_quota_update
  AFTER UPDATE ON public.app_db_data
  FOR EACH ROW EXECUTE FUNCTION public.update_db_quota();
CREATE TRIGGER trigger_db_data_quota_delete
  AFTER DELETE ON public.app_db_data
  FOR EACH ROW EXECUTE FUNCTION public.update_db_quota();
CREATE TRIGGER trigger_db_schema_quota
  AFTER INSERT OR DELETE ON public.app_db_schemas
  FOR EACH ROW EXECUTE FUNCTION public.update_db_quota();

-- ==========================================
-- 4. Deploy Previews (self-hosted)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.deployed_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled Deploy',
  active BOOLEAN NOT NULL DEFAULT true,
  views INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.deployed_project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deploy_id UUID NOT NULL REFERENCES public.deployed_projects(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deployed_projects_owner ON public.deployed_projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_deployed_project_files_deploy ON public.deployed_project_files(deploy_id);
CREATE INDEX IF NOT EXISTS idx_deployed_project_files_path ON public.deployed_project_files(deploy_id, path);

ALTER TABLE public.deployed_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployed_project_files ENABLE ROW LEVEL SECURITY;

-- Deployed projects: public read for active, owner write
CREATE POLICY "deployed_projects_select_active" ON public.deployed_projects
  FOR SELECT USING (active = true OR auth.uid() = owner_id);
CREATE POLICY "deployed_projects_insert_own" ON public.deployed_projects
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "deployed_projects_update_own" ON public.deployed_projects
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "deployed_projects_delete_own" ON public.deployed_projects
  FOR DELETE USING (auth.uid() = owner_id);

-- Deployed files: public read for active deploys, owner write
CREATE POLICY "deployed_files_select_active" ON public.deployed_project_files
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.deployed_projects dp WHERE dp.id = deploy_id AND (dp.active = true OR dp.owner_id = auth.uid()))
  );
CREATE POLICY "deployed_files_insert_own" ON public.deployed_project_files
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.deployed_projects dp WHERE dp.id = deploy_id AND dp.owner_id = auth.uid())
  );
CREATE POLICY "deployed_files_delete_own" ON public.deployed_project_files
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.deployed_projects dp WHERE dp.id = deploy_id AND dp.owner_id = auth.uid())
  );

CREATE TRIGGER set_deployed_projects_updated_at
  BEFORE UPDATE ON public.deployed_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==========================================
-- 5. Gallery (showcase)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.gallery_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  preview_url TEXT NOT NULL DEFAULT '',
  likes INT NOT NULL DEFAULT 0,
  views INT NOT NULL DEFAULT 0,
  featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gallery_project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id UUID NOT NULL REFERENCES public.gallery_projects(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gallery_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id UUID NOT NULL REFERENCES public.gallery_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(gallery_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_gallery_projects_owner ON public.gallery_projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_gallery_project_files_gallery ON public.gallery_project_files(gallery_id);
CREATE INDEX IF NOT EXISTS idx_gallery_likes_gallery ON public.gallery_likes(gallery_id);
CREATE INDEX IF NOT EXISTS idx_gallery_likes_user ON public.gallery_likes(user_id);

ALTER TABLE public.gallery_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gallery_select_all" ON public.gallery_projects FOR SELECT USING (true);
CREATE POLICY "gallery_insert_auth" ON public.gallery_projects FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "gallery_update_own" ON public.gallery_projects FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "gallery_delete_own" ON public.gallery_projects FOR DELETE USING (auth.uid() = owner_id);

CREATE POLICY "gallery_files_select_all" ON public.gallery_project_files FOR SELECT USING (true);
CREATE POLICY "gallery_files_insert_auth" ON public.gallery_project_files FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.gallery_projects gp WHERE gp.id = gallery_id AND gp.owner_id = auth.uid())
);

CREATE POLICY "gallery_likes_select_all" ON public.gallery_likes FOR SELECT USING (true);
CREATE POLICY "gallery_likes_insert_auth" ON public.gallery_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gallery_likes_delete_own" ON public.gallery_likes FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_gallery_projects_updated_at
  BEFORE UPDATE ON public.gallery_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==========================================
-- 6. Recently Viewed
-- ==========================================

CREATE TABLE IF NOT EXISTS public.recently_viewed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, project_id)
);

ALTER TABLE public.recently_viewed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recently_viewed_select_own" ON public.recently_viewed
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "recently_viewed_insert_own" ON public.recently_viewed
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recently_viewed_delete_own" ON public.recently_viewed
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_recently_viewed_user ON public.recently_viewed(user_id, viewed_at DESC);

-- ==========================================
-- 7. Realtime (optional — enables live updates)
-- ==========================================
-- Enable realtime for chat/collab features if desired
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.app_db_data;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.app_db_schemas;

-- ==========================================
-- DONE! All tables and policies are created.
-- ==========================================
