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

  if (!url || !key) {
    return null;
  }

  const opts: any = {};
  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    opts.auth = { persistSession: false, autoRefreshToken: false };
  }

  return createClient(url, key, opts);
}

// GET /api/deploy-view?id=xxx — Load deployed project files
export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const deployId = url.searchParams.get('id');

  if (!deployId) {
    return json({ error: 'Missing deploy id' }, { status: 400 });
  }

  const supabase = getServerSupabase(context);
  if (!supabase) {
    return json({ error: 'Database not configured' }, { status: 500 });
  }

  // Get the deployed project record
  const { data: deploy, error: deployError } = await supabase
    .from('deployed_projects')
    .select('id, name, description, created_at, is_active')
    .eq('id', deployId)
    .single();

  if (deployError || !deploy) {
    return json({ error: 'Deploy not found' }, { status: 404 });
  }

  if (!deploy.is_active) {
    return json({ error: 'This deploy has been deactivated' }, { status: 410 });
  }

  // Get the files
  const { data: files, error: filesError } = await supabase
    .from('deployed_project_files')
    .select('path, content')
    .eq('deploy_id', deployId);

  if (filesError) {
    return json({ error: 'Failed to load files' }, { status: 500 });
  }

  return json({
    deploy: {
      id: deploy.id,
      name: deploy.name,
      description: deploy.description,
      createdAt: deploy.created_at,
    },
    files: files || [],
  });
}

// POST /api/deploy-view — Create a new deploy
export async function action({ request, context }: ActionFunctionArgs) {
  const supabase = getServerSupabase(context);
  if (!supabase) {
    return json({ error: 'Database not configured' }, { status: 500 });
  }

  const body = await request.json();
  const { action: deployAction, deployId, name, description, files } = body;

  if (deployAction === 'create') {
    // Create a new deployed project
    if (!name || !files || files.length === 0) {
      return json({ error: 'Name and files are required' }, { status: 400 });
    }

    // Create the deploy record
    const { data: deploy, error: deployError } = await supabase
      .from('deployed_projects')
      .insert({
        name,
        description: description || '',
        is_active: true,
      })
      .select('id')
      .single();

    if (deployError) {
      // If the table doesn't exist, return a helpful error
      if (deployError.code === '42P01') {
        return json({
          error: 'deployed_projects table not found. Please run the migration SQL first.',
          migrationNeeded: true,
        }, { status: 500 });
      }
      return json({ error: deployError.message }, { status: 500 });
    }

    // Insert files in batches
    const filesToInsert = files.map((f: { path: string; content: string }) => ({
      deploy_id: deploy.id,
      path: f.path,
      content: f.content,
    }));

    const batchSize = 100;
    for (let i = 0; i < filesToInsert.length; i += batchSize) {
      const batch = filesToInsert.slice(i, i + batchSize);
      const { error: filesError } = await supabase
        .from('deployed_project_files')
        .insert(batch);

      if (filesError) {
        // Clean up deploy if files fail
        await supabase.from('deployed_projects').delete().eq('id', deploy.id);
        return json({ error: `Failed to save files: ${filesError.message}` }, { status: 500 });
      }
    }

    // Generate the view URL
    const origin = new URL(request.url).origin;
    const viewUrl = `${origin}/view/${deploy.id}`;

    return json({
      success: true,
      deployId: deploy.id,
      viewUrl,
    });
  }

  if (deployAction === 'deactivate') {
    // Deactivate a deploy
    const { error } = await supabase
      .from('deployed_projects')
      .update({ is_active: false })
      .eq('id', deployId);

    if (error) {
      return json({ error: error.message }, { status: 500 });
    }

    return json({ success: true });
  }

  return json({ error: 'Invalid action' }, { status: 400 });
}
