-- ============================================================
-- Omni-Builder — Migração SQL COMPLETA para Supabase (IDEMPOTENTE v2)
-- Execute ESTE ARQUIVO INTEIRO no SQL Editor do Supabase
-- Seguro para executar múltiplas vezes — não falha se já existir
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

-- Add columns if table already existed from old migration
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';
-- LLM API keys and last used provider/model (for persistence across devices)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS anthropic_key TEXT NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS openrouter_key TEXT NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS google_key TEXT NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_provider TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_model TEXT;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Idempotent policies: drop first if exists, then create
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Idempotent trigger
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
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
  cloudflare_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  omnibuilder_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_deploy JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add columns if table already exists (safe ALTER)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS custom_rules TEXT NOT NULL DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS preview_mode TEXT NOT NULL DEFAULT 'webcontainer';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'anthropic';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS model TEXT NOT NULL DEFAULT 'claude-3-5-sonnet-20240620';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS netlify_config JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS vercel_config JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS cloudrun_config JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS database_config JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS google_drive_config JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS cloudflare_config JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS omnibuilder_config JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS last_deploy JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Idempotent policies
DROP POLICY IF EXISTS "projects_select_own" ON public.projects;
DROP POLICY IF EXISTS "projects_insert_own" ON public.projects;
DROP POLICY IF EXISTS "projects_update_own" ON public.projects;
DROP POLICY IF EXISTS "projects_delete_own" ON public.projects;

CREATE POLICY "projects_select_own" ON public.projects
  FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "projects_insert_own" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "projects_update_own" ON public.projects
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "projects_delete_own" ON public.projects
  FOR DELETE USING (auth.uid() = owner_id);

-- Idempotent trigger
DROP TRIGGER IF EXISTS set_projects_updated_at ON public.projects;
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

-- Idempotent RLS Policies
DROP POLICY IF EXISTS "db_schemas_select_own" ON public.app_db_schemas;
DROP POLICY IF EXISTS "db_schemas_insert_own" ON public.app_db_schemas;
DROP POLICY IF EXISTS "db_schemas_update_own" ON public.app_db_schemas;
DROP POLICY IF EXISTS "db_schemas_delete_own" ON public.app_db_schemas;

CREATE POLICY "db_schemas_select_own" ON public.app_db_schemas
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "db_schemas_insert_own" ON public.app_db_schemas
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "db_schemas_update_own" ON public.app_db_schemas
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "db_schemas_delete_own" ON public.app_db_schemas
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));

DROP POLICY IF EXISTS "db_data_select_own" ON public.app_db_data;
DROP POLICY IF EXISTS "db_data_insert_own" ON public.app_db_data;
DROP POLICY IF EXISTS "db_data_update_own" ON public.app_db_data;
DROP POLICY IF EXISTS "db_data_delete_own" ON public.app_db_data;

CREATE POLICY "db_data_select_own" ON public.app_db_data
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "db_data_insert_own" ON public.app_db_data
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "db_data_update_own" ON public.app_db_data
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "db_data_delete_own" ON public.app_db_data
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));

DROP POLICY IF EXISTS "db_quota_select_own" ON public.app_db_quota;
DROP POLICY IF EXISTS "db_quota_insert_own" ON public.app_db_quota;
DROP POLICY IF EXISTS "db_quota_update_own" ON public.app_db_quota;

CREATE POLICY "db_quota_select_own" ON public.app_db_quota
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "db_quota_insert_own" ON public.app_db_quota
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "db_quota_update_own" ON public.app_db_quota
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));

-- Idempotent triggers
DROP TRIGGER IF EXISTS set_app_db_schemas_updated_at ON public.app_db_schemas;
DROP TRIGGER IF EXISTS set_app_db_data_updated_at ON public.app_db_data;
DROP TRIGGER IF EXISTS set_app_db_quota_updated_at ON public.app_db_quota;

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

-- Idempotent quota triggers
DROP TRIGGER IF EXISTS trigger_db_data_quota_insert ON public.app_db_data;
DROP TRIGGER IF EXISTS trigger_db_data_quota_update ON public.app_db_data;
DROP TRIGGER IF EXISTS trigger_db_data_quota_delete ON public.app_db_data;
DROP TRIGGER IF EXISTS trigger_db_schema_quota ON public.app_db_schemas;

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
-- NOTE: Old migration created deployed_projects WITHOUT owner_id.
--       We add the missing columns here with ALTER TABLE IF NOT EXISTS.

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

-- Step 1: Rename old columns FIRST (before adding new ones to avoid conflicts)
-- Rename is_active -> active (only if is_active exists AND active does NOT exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deployed_projects' AND column_name = 'is_active'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deployed_projects' AND column_name = 'active'
  ) THEN
    ALTER TABLE public.deployed_projects RENAME COLUMN is_active TO active;
  END IF;
  -- If BOTH is_active and active exist, just drop the old one
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deployed_projects' AND column_name = 'is_active'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deployed_projects' AND column_name = 'active'
  ) THEN
    ALTER TABLE public.deployed_projects DROP COLUMN is_active;
  END IF;
END $$;

-- Step 2: Add columns that may be missing from old migration
ALTER TABLE public.deployed_projects ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.deployed_projects ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.deployed_projects ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.deployed_projects ADD COLUMN IF NOT EXISTS views INT NOT NULL DEFAULT 0;
ALTER TABLE public.deployed_projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

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

-- Drop old index if it exists from old migration
DROP INDEX IF EXISTS idx_deployed_project_files_deploy_id;
DROP INDEX IF EXISTS idx_deployed_projects_active;

ALTER TABLE public.deployed_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployed_project_files ENABLE ROW LEVEL SECURITY;

-- Drop OLD policies from old migration that use different names
DROP POLICY IF EXISTS "Anyone can read active deploys" ON public.deployed_projects;
DROP POLICY IF EXISTS "Anyone can read deploy files" ON public.deployed_project_files;
DROP POLICY IF EXISTS "Service role can manage deploys" ON public.deployed_projects;
DROP POLICY IF EXISTS "Service role can manage deploy files" ON public.deployed_project_files;

-- Idempotent policies
DROP POLICY IF EXISTS "deployed_projects_select_active" ON public.deployed_projects;
DROP POLICY IF EXISTS "deployed_projects_insert_own" ON public.deployed_projects;
DROP POLICY IF EXISTS "deployed_projects_update_own" ON public.deployed_projects;
DROP POLICY IF EXISTS "deployed_projects_delete_own" ON public.deployed_projects;

CREATE POLICY "deployed_projects_select_active" ON public.deployed_projects
  FOR SELECT USING (active = true OR auth.uid() = owner_id);
CREATE POLICY "deployed_projects_insert_own" ON public.deployed_projects
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "deployed_projects_update_own" ON public.deployed_projects
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "deployed_projects_delete_own" ON public.deployed_projects
  FOR DELETE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "deployed_files_select_active" ON public.deployed_project_files;
DROP POLICY IF EXISTS "deployed_files_insert_own" ON public.deployed_project_files;
DROP POLICY IF EXISTS "deployed_files_delete_own" ON public.deployed_project_files;

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

DROP TRIGGER IF EXISTS set_deployed_projects_updated_at ON public.deployed_projects;
CREATE TRIGGER set_deployed_projects_updated_at
  BEFORE UPDATE ON public.deployed_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==========================================
-- 5. Gallery (showcase)
-- ==========================================
-- NOTE: Old migration used author_id instead of owner_id,
--       project_id instead of gallery_id in files/likes,
--       name instead of title.
--       We handle the migration by adding missing columns
--       and renaming old ones.

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

-- Step 1: Rename old columns FIRST (before adding new ones to avoid conflicts)
DO $$
BEGIN
  -- author_id -> owner_id
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gallery_projects' AND column_name = 'author_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gallery_projects' AND column_name = 'owner_id') THEN
    ALTER TABLE public.gallery_projects RENAME COLUMN author_id TO owner_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gallery_projects' AND column_name = 'author_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gallery_projects' AND column_name = 'owner_id') THEN
    ALTER TABLE public.gallery_projects DROP COLUMN author_id;
  END IF;

  -- name -> title
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gallery_projects' AND column_name = 'name')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gallery_projects' AND column_name = 'title') THEN
    ALTER TABLE public.gallery_projects RENAME COLUMN name TO title;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gallery_projects' AND column_name = 'name')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gallery_projects' AND column_name = 'title') THEN
    ALTER TABLE public.gallery_projects DROP COLUMN name;
  END IF;

  -- thumbnail -> preview_url
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gallery_projects' AND column_name = 'thumbnail')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gallery_projects' AND column_name = 'preview_url') THEN
    ALTER TABLE public.gallery_projects RENAME COLUMN thumbnail TO preview_url;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gallery_projects' AND column_name = 'thumbnail')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gallery_projects' AND column_name = 'preview_url') THEN
    ALTER TABLE public.gallery_projects DROP COLUMN thumbnail;
  END IF;

  -- is_featured -> featured
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gallery_projects' AND column_name = 'is_featured')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gallery_projects' AND column_name = 'featured') THEN
    ALTER TABLE public.gallery_projects RENAME COLUMN is_featured TO featured;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gallery_projects' AND column_name = 'is_featured')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gallery_projects' AND column_name = 'featured') THEN
    ALTER TABLE public.gallery_projects DROP COLUMN is_featured;
  END IF;
END $$;

-- Step 2: Add columns that may be missing from old migration
ALTER TABLE public.gallery_projects ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.gallery_projects ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.gallery_projects ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Untitled';
ALTER TABLE public.gallery_projects ADD COLUMN IF NOT EXISTS preview_url TEXT NOT NULL DEFAULT '';
ALTER TABLE public.gallery_projects ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;

-- Gallery project files
CREATE TABLE IF NOT EXISTS public.gallery_project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id UUID NOT NULL REFERENCES public.gallery_projects(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add gallery_id column if missing (old migration used project_id)
ALTER TABLE public.gallery_project_files ADD COLUMN IF NOT EXISTS gallery_id UUID REFERENCES public.gallery_projects(id) ON DELETE CASCADE;

-- Rename old column project_id -> gallery_id in gallery_project_files if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'gallery_project_files' AND column_name = 'project_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'gallery_project_files' AND column_name = 'gallery_id'
  ) THEN
    -- First copy data from old column to new column if new column is null
    UPDATE public.gallery_project_files SET gallery_id = project_id WHERE gallery_id IS NULL;
    -- Then drop the old column
    ALTER TABLE public.gallery_project_files DROP COLUMN project_id;
  END IF;
END $$;

-- Gallery likes
CREATE TABLE IF NOT EXISTS public.gallery_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id UUID NOT NULL REFERENCES public.gallery_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(gallery_id, user_id)
);

-- Add gallery_id column if missing (old migration used project_id)
ALTER TABLE public.gallery_likes ADD COLUMN IF NOT EXISTS gallery_id UUID REFERENCES public.gallery_projects(id) ON DELETE CASCADE;

-- Rename old column project_id -> gallery_id in gallery_likes if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'gallery_likes' AND column_name = 'project_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'gallery_likes' AND column_name = 'gallery_id'
  ) THEN
    UPDATE public.gallery_likes SET gallery_id = project_id WHERE gallery_id IS NULL;
    ALTER TABLE public.gallery_likes DROP COLUMN project_id;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gallery_projects_owner ON public.gallery_projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_gallery_project_files_gallery ON public.gallery_project_files(gallery_id);
CREATE INDEX IF NOT EXISTS idx_gallery_likes_gallery ON public.gallery_likes(gallery_id);
CREATE INDEX IF NOT EXISTS idx_gallery_likes_user ON public.gallery_likes(user_id);

-- Drop old indexes from old migration
DROP INDEX IF EXISTS idx_gallery_projects_published;
DROP INDEX IF EXISTS idx_gallery_projects_author;
DROP INDEX IF EXISTS idx_gallery_projects_category;
DROP INDEX IF EXISTS idx_gallery_files_project;
DROP INDEX IF EXISTS idx_gallery_likes_project;

ALTER TABLE public.gallery_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_likes ENABLE ROW LEVEL SECURITY;

-- Drop OLD policies from old migration that use different names
DROP POLICY IF EXISTS "gallery_projects_select_public" ON public.gallery_projects;
DROP POLICY IF EXISTS "gallery_projects_select_own" ON public.gallery_projects;
DROP POLICY IF EXISTS "gallery_files_select_public" ON public.gallery_project_files;
DROP POLICY IF EXISTS "gallery_files_select_own" ON public.gallery_project_files;
DROP POLICY IF EXISTS "gallery_files_update_own" ON public.gallery_project_files;
DROP POLICY IF EXISTS "gallery_files_delete_own" ON public.gallery_project_files;
DROP POLICY IF EXISTS "gallery_likes_select_public" ON public.gallery_likes;

-- Idempotent policies
DROP POLICY IF EXISTS "gallery_select_all" ON public.gallery_projects;
DROP POLICY IF EXISTS "gallery_insert_auth" ON public.gallery_projects;
DROP POLICY IF EXISTS "gallery_update_own" ON public.gallery_projects;
DROP POLICY IF EXISTS "gallery_delete_own" ON public.gallery_projects;

CREATE POLICY "gallery_select_all" ON public.gallery_projects FOR SELECT USING (true);
CREATE POLICY "gallery_insert_auth" ON public.gallery_projects FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "gallery_update_own" ON public.gallery_projects FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "gallery_delete_own" ON public.gallery_projects FOR DELETE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "gallery_files_select_all" ON public.gallery_project_files;
DROP POLICY IF EXISTS "gallery_files_insert_auth" ON public.gallery_project_files;

CREATE POLICY "gallery_files_select_all" ON public.gallery_project_files FOR SELECT USING (true);
CREATE POLICY "gallery_files_insert_auth" ON public.gallery_project_files FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.gallery_projects gp WHERE gp.id = gallery_id AND gp.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "gallery_likes_select_all" ON public.gallery_likes;
DROP POLICY IF EXISTS "gallery_likes_insert_auth" ON public.gallery_likes;
DROP POLICY IF EXISTS "gallery_likes_delete_own" ON public.gallery_likes;

CREATE POLICY "gallery_likes_select_all" ON public.gallery_likes FOR SELECT USING (true);
CREATE POLICY "gallery_likes_insert_auth" ON public.gallery_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gallery_likes_delete_own" ON public.gallery_likes FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_gallery_projects_updated_at ON public.gallery_projects;
CREATE TRIGGER set_gallery_projects_updated_at
  BEFORE UPDATE ON public.gallery_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_gallery_project_files_updated_at ON public.gallery_project_files;

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

-- Idempotent policies
DROP POLICY IF EXISTS "recently_viewed_select_own" ON public.recently_viewed;
DROP POLICY IF EXISTS "recently_viewed_insert_own" ON public.recently_viewed;
DROP POLICY IF EXISTS "recently_viewed_delete_own" ON public.recently_viewed;

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
