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
