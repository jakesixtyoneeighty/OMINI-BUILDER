-- Omni Builder Built-in Database Migration
-- Each project gets 100MB of free database storage
-- Uses a document/collection-based approach (like Firebase) on top of Supabase

-- Table schemas for each project's database collections
CREATE TABLE IF NOT EXISTS public.app_db_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  collection_name TEXT NOT NULL,
  schema_def JSONB NOT NULL DEFAULT '{}',  -- { fieldName: { type, required, unique, default } }
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, collection_name)
);

-- Actual data for each project's collections
CREATE TABLE IF NOT EXISTS public.app_db_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  collection_name TEXT NOT NULL,
  row_id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quota tracking per project (100MB = 104857600 bytes)
CREATE TABLE IF NOT EXISTS public.app_db_quota (
  project_id UUID PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  used_bytes BIGINT NOT NULL DEFAULT 0,
  max_bytes BIGINT NOT NULL DEFAULT 104857600,  -- 100MB
  row_count BIGINT NOT NULL DEFAULT 0,
  collection_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_app_db_schemas_project ON public.app_db_schemas(project_id);
CREATE INDEX IF NOT EXISTS idx_app_db_data_project ON public.app_db_data(project_id);
CREATE INDEX IF NOT EXISTS idx_app_db_data_collection ON public.app_db_data(project_id, collection_name);
CREATE INDEX IF NOT EXISTS idx_app_db_data_row_id ON public.app_db_data(project_id, collection_name, row_id);

-- Enable RLS
ALTER TABLE public.app_db_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_db_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_db_quota ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only project owners can access their data
-- Schemas
CREATE POLICY "db_schemas_select_own" ON public.app_db_schemas
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  );
CREATE POLICY "db_schemas_insert_own" ON public.app_db_schemas
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  );
CREATE POLICY "db_schemas_update_own" ON public.app_db_schemas
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  );
CREATE POLICY "db_schemas_delete_own" ON public.app_db_schemas
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  );

-- Data
CREATE POLICY "db_data_select_own" ON public.app_db_data
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  );
CREATE POLICY "db_data_insert_own" ON public.app_db_data
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  );
CREATE POLICY "db_data_update_own" ON public.app_db_data
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  );
CREATE POLICY "db_data_delete_own" ON public.app_db_data
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  );

-- Quota
CREATE POLICY "db_quota_select_own" ON public.app_db_quota
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  );
CREATE POLICY "db_quota_insert_own" ON public.app_db_quota
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  );
CREATE POLICY "db_quota_update_own" ON public.app_db_quota
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  );

-- Auto-update updated_at triggers
CREATE TRIGGER set_app_db_schemas_updated_at
  BEFORE UPDATE ON public.app_db_schemas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_app_db_data_updated_at
  BEFORE UPDATE ON public.app_db_data
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_app_db_quota_updated_at
  BEFORE UPDATE ON public.app_db_quota
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Function to automatically update quota when data changes
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
  -- Determine project_id from the triggering row
  IF TG_OP = 'DELETE' THEN
    v_project_id := OLD.project_id;
  ELSE
    v_project_id := NEW.project_id;
  END IF;

  -- Calculate total data size for this project
  SELECT COALESCE(SUM(pg_column_size(data)), 0) INTO v_data_size
  FROM public.app_db_data
  WHERE project_id = v_project_id;

  -- Count rows
  SELECT COUNT(*) INTO v_row_count
  FROM public.app_db_data
  WHERE project_id = v_project_id;

  -- Count collections
  SELECT COUNT(*) INTO v_collection_count
  FROM public.app_db_schemas
  WHERE project_id = v_project_id;

  -- Upsert quota record
  INSERT INTO public.app_db_quota (project_id, used_bytes, max_bytes, row_count, collection_count, updated_at)
  VALUES (v_project_id, v_data_size, 104857600, v_row_count, v_collection_count, NOW())
  ON CONFLICT (project_id) DO UPDATE
  SET used_bytes = v_data_size,
      row_count = v_row_count,
      collection_count = v_collection_count,
      updated_at = NOW();

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Triggers to auto-update quota
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
