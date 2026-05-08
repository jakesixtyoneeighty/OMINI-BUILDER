-- Migration: Deployed Projects (self-hosted preview deploys)
-- Run this SQL in your Supabase SQL Editor

-- Deployed projects table
CREATE TABLE IF NOT EXISTS deployed_projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Deployed project files table
CREATE TABLE IF NOT EXISTS deployed_project_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deploy_id UUID NOT NULL REFERENCES deployed_projects(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast file lookup by deploy_id
CREATE INDEX IF NOT EXISTS idx_deployed_project_files_deploy_id ON deployed_project_files(deploy_id);
CREATE INDEX IF NOT EXISTS idx_deployed_project_files_path ON deployed_project_files(deploy_id, path);

-- Index for active deploys
CREATE INDEX IF NOT EXISTS idx_deployed_projects_active ON deployed_projects(is_active);

-- Enable RLS
ALTER TABLE deployed_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployed_project_files ENABLE ROW LEVEL SECURITY;

-- Public can read active deploys (viewer page needs this)
CREATE POLICY "Anyone can read active deploys" ON deployed_projects
  FOR SELECT USING (is_active = true);

CREATE POLICY "Anyone can read deploy files" ON deployed_project_files
  FOR SELECT USING (
    deploy_id IN (SELECT id FROM deployed_projects WHERE is_active = true)
  );

-- Only service role can create/update/delete deploys
CREATE POLICY "Service role can manage deploys" ON deployed_projects
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage deploy files" ON deployed_project_files
  FOR ALL USING (auth.role() = 'service_role');
