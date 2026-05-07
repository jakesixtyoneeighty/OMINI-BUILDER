-- Migration: Add new columns to projects table and create recently_viewed table
-- Run this on existing Supabase instances

-- Add new columns to projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS custom_rules text NOT NULL DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS preview_mode text NOT NULL DEFAULT 'webcontainer';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS netlify_config jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS vercel_config jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS cloudrun_config jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS database_config jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS google_drive_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Add display_name to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;

-- Create recently_viewed table
CREATE TABLE IF NOT EXISTS public.recently_viewed (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  unique (user_id, project_id)
);

ALTER TABLE public.recently_viewed enable row level security;

CREATE POLICY "recently_viewed_select_own" ON public.recently_viewed
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "recently_viewed_insert_own" ON public.recently_viewed
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "recently_viewed_delete_own" ON public.recently_viewed
FOR DELETE USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_recently_viewed_user ON public.recently_viewed(user_id, viewed_at DESC);
