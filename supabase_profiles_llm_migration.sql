-- Migration: Add LLM key columns to profiles table
-- These columns store per-user API keys and last used provider/model

-- Add LLM API key columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS anthropic_key text NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS openrouter_key text NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS google_key text NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_provider text NOT NULL DEFAULT 'openrouter';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_model text NOT NULL DEFAULT 'openrouter/free';

-- Add cloudflare_config column to projects if missing
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS cloudflare_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Add omnibuilder_config column to projects if missing (stores deploy ID for reuse)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS omnibuilder_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Add messages column to projects if missing (stores chat messages for cloud persistence)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS messages jsonb DEFAULT '[]'::jsonb;

-- Function: get_user_storage_usage — returns total bytes used by a user
CREATE OR REPLACE FUNCTION public.get_user_storage_usage(user_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total BIGINT := 0;
BEGIN
  -- Messages storage (JSONB size)
  SELECT COALESCE(SUM(pg_column_size(messages)), 0) INTO total
  FROM public.projects
  WHERE owner_id = user_id;

  -- Deployed project files
  SELECT total + COALESCE(SUM(LENGTH(content)), 0) INTO total
  FROM public.deployed_project_files f
  INNER JOIN public.deployed_projects d ON d.id = f.deploy_id
  WHERE d.owner_id = user_id;

  -- Gallery project files
  SELECT total + COALESCE(SUM(LENGTH(content)), 0) INTO total
  FROM public.gallery_project_files gf
  INNER JOIN public.gallery_projects gp ON gp.id = gf.gallery_id
  WHERE gp.owner_id = user_id;

  RETURN total;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_storage_usage(UUID) TO authenticated;
