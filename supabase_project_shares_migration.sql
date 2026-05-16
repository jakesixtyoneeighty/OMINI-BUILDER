-- Migration: Create/fix project_shares table for project sharing feature
-- Idempotent: Can be run multiple times without errors
-- Handles both: fresh install AND upgrade from old schema (with accepted/can_edit/owner_id columns)
-- Run this in your Supabase SQL Editor

-- =============================================
-- 1. Create the table (if not exists - fresh install only)
-- =============================================
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

-- =============================================
-- 2. Add missing columns (for upgrade from old schema)
-- Old schema had: owner_id, accepted, can_edit, accepted_at, expires_at
-- New schema needs: collaborator_name, collaborator_avatar, status, updated_at
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_shares' AND column_name = 'status') THEN
    ALTER TABLE project_shares ADD COLUMN status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_shares' AND column_name = 'collaborator_name') THEN
    ALTER TABLE project_shares ADD COLUMN collaborator_name TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_shares' AND column_name = 'collaborator_avatar') THEN
    ALTER TABLE project_shares ADD COLUMN collaborator_avatar TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_shares' AND column_name = 'updated_at') THEN
    ALTER TABLE project_shares ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;
  END IF;
END $$;

-- =============================================
-- 3. Migrate data from old columns to new 'status' column
-- =============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_shares' AND column_name = 'accepted')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_shares' AND column_name = 'status') THEN
    UPDATE project_shares SET status = 'active' WHERE accepted = true AND status IS NULL;
    UPDATE project_shares SET status = 'pending' WHERE (accepted = false OR accepted IS NULL) AND status IS NULL;
    UPDATE project_shares SET status = 'pending' WHERE status IS NULL;
  END IF;
END $$;

-- =============================================
-- 4. DROP ALL OLD POLICIES FIRST (they depend on owner_id)
-- This MUST happen before dropping the owner_id column
-- =============================================
DROP POLICY IF EXISTS "shares_select_owner" ON project_shares;
DROP POLICY IF EXISTS "shares_select_collaborator" ON project_shares;
DROP POLICY IF EXISTS "shares_insert_owner" ON project_shares;
DROP POLICY IF EXISTS "shares_update_owner" ON project_shares;
DROP POLICY IF EXISTS "shares_delete_owner" ON project_shares;
DROP POLICY IF EXISTS "shares_accept_collaborator" ON project_shares;
DROP POLICY IF EXISTS "shares_select_by_token" ON project_shares;
-- Also drop new-style policies in case of re-run
DROP POLICY IF EXISTS "Owner can view shares for their projects" ON project_shares;
DROP POLICY IF EXISTS "Owner can create shares" ON project_shares;
DROP POLICY IF EXISTS "Owner can update shares" ON project_shares;
DROP POLICY IF EXISTS "Owner can delete shares" ON project_shares;
DROP POLICY IF EXISTS "Collaborators can view their shares" ON project_shares;

-- =============================================
-- 5. Drop old columns that are no longer needed
-- Now safe because dependent policies are gone
-- =============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_shares' AND column_name = 'accepted') THEN
    ALTER TABLE project_shares DROP COLUMN accepted;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_shares' AND column_name = 'can_edit') THEN
    ALTER TABLE project_shares DROP COLUMN can_edit;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_shares' AND column_name = 'accepted_at') THEN
    ALTER TABLE project_shares DROP COLUMN accepted_at;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_shares' AND column_name = 'expires_at') THEN
    ALTER TABLE project_shares DROP COLUMN expires_at;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_shares' AND column_name = 'owner_id') THEN
    ALTER TABLE project_shares DROP COLUMN owner_id;
  END IF;
END $$;

-- =============================================
-- 6. Fix share_token type (old was TEXT, new is UUID)
-- =============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_shares' AND column_name = 'share_token' AND data_type = 'text') THEN
    ALTER TABLE project_shares DROP CONSTRAINT IF EXISTS project_shares_share_token_key;
    ALTER TABLE project_shares ALTER COLUMN share_token DROP DEFAULT;
    UPDATE project_shares SET share_token = gen_random_uuid()::text WHERE share_token !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    ALTER TABLE project_shares ALTER COLUMN share_token TYPE UUID USING share_token::uuid;
    ALTER TABLE project_shares ALTER COLUMN share_token SET DEFAULT gen_random_uuid();
  END IF;
END $$;

-- =============================================
-- 7. Drop old unique constraint if it exists
-- =============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'project_shares' AND constraint_name = 'project_shares_project_id_collaborator_email_key') THEN
    ALTER TABLE project_shares DROP CONSTRAINT project_shares_project_id_collaborator_email_key;
  END IF;
END $$;

-- =============================================
-- 8. Create indexes
-- =============================================
CREATE INDEX IF NOT EXISTS idx_project_shares_project_id ON project_shares(project_id);
CREATE INDEX IF NOT EXISTS idx_project_shares_share_token ON project_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_project_shares_collaborator_id ON project_shares(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_project_shares_collaborator_email ON project_shares(collaborator_email);

-- =============================================
-- 9. Enable Row Level Security
-- =============================================
ALTER TABLE project_shares ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 10. Create NEW RLS policies (using project→owner relationship)
-- =============================================

-- Policy: Project owner + collaborators can view shares
CREATE POLICY "Owner can view shares for their projects"
  ON project_shares FOR SELECT
  USING (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
    OR collaborator_id = auth.uid()
  );

-- Policy: Project owner can create shares
CREATE POLICY "Owner can create shares"
  ON project_shares FOR INSERT
  WITH CHECK (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

-- Policy: Project owner + collaborator can update shares
CREATE POLICY "Owner can update shares"
  ON project_shares FOR UPDATE
  USING (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
    OR collaborator_id = auth.uid()
  );

-- Policy: Project owner can delete shares
CREATE POLICY "Owner can delete shares"
  ON project_shares FOR DELETE
  USING (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

-- Policy: Collaborators can view shares they're part of
CREATE POLICY "Collaborators can view their shares"
  ON project_shares FOR SELECT
  USING (
    collaborator_id = auth.uid()
  );

-- =============================================
-- 11. Enable Realtime for collaborative editing (idempotent)
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'project_shares' AND schemaname = 'public') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.project_shares;
  END IF;
END $$;

-- =============================================
-- 12. Refresh PostgREST schema cache
-- =============================================
NOTIFY pgrst, 'reload schema';
