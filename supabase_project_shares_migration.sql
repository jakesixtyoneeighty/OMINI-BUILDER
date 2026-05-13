-- Migration: Create project_shares table for project sharing feature
-- Run this in your Supabase SQL Editor

-- Create the project_shares table
CREATE TABLE IF NOT EXISTS project_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  share_type TEXT NOT NULL CHECK (share_type IN ('collaborative', 'basic')),
  share_token UUID DEFAULT gen_random_uuid() NOT NULL,
  collaborator_id UUID,
  collaborator_email TEXT,
  collaborator_name TEXT,
  collaborator_avatar TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_project_shares_project_id ON project_shares(project_id);
CREATE INDEX IF NOT EXISTS idx_project_shares_share_token ON project_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_project_shares_collaborator_id ON project_shares(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_project_shares_collaborator_email ON project_shares(collaborator_email);

-- Enable Row Level Security
ALTER TABLE project_shares ENABLE ROW LEVEL SECURITY;

-- Policy: Project owner can see all shares for their projects
CREATE POLICY "Owner can view shares for their projects"
  ON project_shares FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
    )
    OR collaborator_id = auth.uid()
  );

-- Policy: Project owner can create shares
CREATE POLICY "Owner can create shares"
  ON project_shares FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

-- Policy: Project owner can update shares
CREATE POLICY "Owner can update shares"
  ON project_shares FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

-- Policy: Project owner can delete shares
CREATE POLICY "Owner can delete shares"
  ON project_shares FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

-- Policy: Collaborators can view shares they're part of
CREATE POLICY "Collaborators can view their shares"
  ON project_shares FOR SELECT
  USING (
    collaborator_id = auth.uid()
  );

-- Enable Realtime for collaborative editing
ALTER PUBLICATION supabase_realtime ADD TABLE project_shares;
