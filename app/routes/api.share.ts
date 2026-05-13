import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { createClient } from '@supabase/supabase-js';

function getServerSupabase(context: any) {
  let env: Record<string, any> = {};
  if (context?.cloudflare?.env) {
    env = context.cloudflare.env;
  } else if (context?.env) {
    env = context.env;
  } else if (typeof process !== 'undefined' && process.env) {
    env = process.env;
  }

  const url = env.SUPABASE_URL || '';
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;

  const opts: any = {};
  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    opts.auth = { persistSession: false, autoRefreshToken: false };
  }
  return createClient(url, key, opts);
}

/**
 * GET /api/share?projectId=xxx - Get share info for a project
 * GET /api/share?shareId=xxx - Get shared project data (for basic share link)
 */
export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId');
  const shareId = url.searchParams.get('shareId');

  const supabase = getServerSupabase(context);
  if (!supabase) {
    return json({ error: 'Database not configured' }, { status: 500 });
  }

  // Get shared project data by share ID (for basic share link)
  if (shareId) {
    const { data: share, error } = await supabase
      .from('project_shares')
      .select('id, project_id, share_type, share_token, created_at')
      .eq('id', shareId)
      .single();

    if (error || !share) {
      return json({ error: 'Share not found' }, { status: 404 });
    }

    // Get project info
    const { data: project, error: projError } = await supabase
      .from('projects')
      .select('id, name, description, logo')
      .eq('id', share.project_id)
      .single();

    if (projError || !project) {
      return json({ error: 'Project not found' }, { status: 404 });
    }

    // Get project files
    const { data: files } = await supabase
      .from('project_files')
      .select('path, content')
      .eq('project_id', share.project_id);

    // For basic shares, don't include messages or settings
    if (share.share_type === 'basic') {
      return json({
        share,
        project: { id: project.id, name: project.name, description: project.description, logo: project.logo },
        files: files || [],
        messages: [],
        settings: null,
      });
    }

    // For collaborative shares, include messages and settings
    const { data: projectFull } = await supabase
      .from('projects')
      .select('*')
      .eq('id', share.project_id)
      .single();

    return json({
      share,
      project: { id: project.id, name: project.name, description: project.description, logo: project.logo },
      files: files || [],
      messages: projectFull?.messages || [],
      settings: {
        previewMode: projectFull?.preview_mode,
        provider: projectFull?.provider,
        model: projectFull?.model,
        envVars: projectFull?.env_vars || [],
        customRules: projectFull?.custom_rules || '',
        name: projectFull?.name || '',
        description: projectFull?.description || '',
      },
    });
  }

  // Get shares for a specific project
  if (projectId) {
    const { data: shares, error } = await supabase
      .from('project_shares')
      .select('id, share_type, collaborator_email, share_token, status, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      return json({ shares: [] });
    }
    return json({ shares: shares || [] });
  }

  return json({ error: 'Missing projectId or shareId' }, { status: 400 });
}

/**
 * POST /api/share - Create a share
 * DELETE /api/share - Revoke a share
 */
export async function action({ request, context }: ActionFunctionArgs) {
  const supabase = getServerSupabase(context);
  if (!supabase) {
    return json({ error: 'Database not configured' }, { status: 500 });
  }

  const body: any = await request.json();
  const { action: shareAction, projectId, shareType, collaboratorEmail, shareId, userId } = body;

  if (shareAction === 'create') {
    if (!projectId) {
      return json({ error: 'projectId is required' }, { status: 400 });
    }
    if (!shareType || !['collaborative', 'basic'].includes(shareType)) {
      return json({ error: 'shareType must be "collaborative" or "basic"' }, { status: 400 });
    }

    // For collaborative shares, collaboratorEmail is required
    if (shareType === 'collaborative' && !collaboratorEmail) {
      return json({ error: 'collaboratorEmail is required for collaborative shares' }, { status: 400 });
    }

    // Generate a unique share token
    const shareToken = crypto.randomUUID();

    // Create the share record
    const insertData: Record<string, any> = {
      project_id: projectId,
      share_type: shareType,
      share_token: shareToken,
      status: shareType === 'basic' ? 'active' : 'pending',
    };

    if (shareType === 'collaborative' && collaboratorEmail) {
      insertData.collaborator_email = collaboratorEmail;

      // Try to find the user by email
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .ilike('email', collaboratorEmail)
        .maybeSingle();

      if (profile) {
        insertData.collaborator_id = profile.id;
        insertData.collaborator_name = profile.display_name || collaboratorEmail;
        insertData.collaborator_avatar = profile.avatar_url || '';
        insertData.status = 'active';
      } else {
        insertData.collaborator_name = collaboratorEmail;
      }
    }

    const { data: share, error } = await supabase
      .from('project_shares')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      // If table doesn't exist, return helpful error
      if (error.code === '42P01') {
        return json({
          error: 'Table project_shares does not exist. Run the migration SQL in Supabase SQL Editor.',
          migrationNeeded: true,
        }, { status: 500 });
      }
      return json({ error: error.message }, { status: 500 });
    }

    return json({ share });
  }

  if (shareAction === 'revoke') {
    if (!shareId) {
      return json({ error: 'shareId is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('project_shares')
      .delete()
      .eq('id', shareId);

    if (error) {
      return json({ error: error.message }, { status: 500 });
    }

    return json({ success: true });
  }

  if (shareAction === 'accept') {
    // Accept a collaborative share invitation
    if (!shareId || !userId) {
      return json({ error: 'shareId and userId are required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('project_shares')
      .update({ status: 'active', collaborator_id: userId })
      .eq('id', shareId);

    if (error) {
      return json({ error: error.message }, { status: 500 });
    }

    return json({ success: true });
  }

  return json({ error: 'Invalid action' }, { status: 400 });
}
