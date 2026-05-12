-- Migration V3: Add messages storage to projects
-- Add messages column to projects (stores the full message array as JSONB)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS messages jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Add provider and model columns if not exist  
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'openrouter';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS model text NOT NULL DEFAULT 'gpt-4o-mini';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS last_deploy jsonb NOT NULL DEFAULT '{}'::jsonb;
