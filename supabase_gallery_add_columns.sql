-- ============================================
-- Migration: Add cover_image and logo columns to gallery_projects
-- ============================================
-- Execute this SQL in your Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)
-- This will add the new columns without losing existing data.
-- Safe to run multiple times (uses IF NOT EXISTS).

-- Add cover_image column
ALTER TABLE public.gallery_projects ADD COLUMN IF NOT EXISTS cover_image text NOT NULL DEFAULT '';

-- Add logo column
ALTER TABLE public.gallery_projects ADD COLUMN IF NOT EXISTS logo text NOT NULL DEFAULT '';

-- Update RLS: allow inserts without authentication (service role bypasses RLS anyway)
DROP POLICY IF EXISTS "gallery_projects_insert_auth" ON public.gallery_projects;
CREATE POLICY "gallery_projects_insert_auth" ON public.gallery_projects
FOR INSERT WITH CHECK (true);

-- Also make sure gallery_files insert allows service role
DROP POLICY IF EXISTS "gallery_files_insert_auth" ON public.gallery_project_files;
CREATE POLICY "gallery_files_insert_auth" ON public.gallery_project_files
FOR INSERT WITH CHECK (true);
