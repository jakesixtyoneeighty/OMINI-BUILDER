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

// The deployed_projects table column was renamed from is_active -> active in a migration.
// Both column names may exist depending on which migration was run.
// We select both and use whichever is available.
function getIsActive(deploy: any): boolean {
  if ('active' in deploy) return deploy.active;
  if ('is_active' in deploy) return deploy.is_active;
  return true;
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

  // Get the deployed project record (select both column name variants)
  const { data: deploy, error: deployError } = await supabase
    .from('deployed_projects')
    .select('id, name, description, created_at, is_active, active')
    .eq('id', deployId)
    .single();

  if (deployError || !deploy) {
    return json({ error: 'Deploy not found' }, { status: 404 });
  }

  if (!getIsActive(deploy)) {
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

// POST /api/deploy-view — Create, update, or deactivate a deploy
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

    // Create the deploy record — use both column names for compatibility
    const insertData: Record<string, any> = {
      name,
      description: description || '',
      is_active: true,
      active: true,
    };

    const { data: deploy, error: deployError } = await supabase
      .from('deployed_projects')
      .insert(insertData)
      .select('id')
      .single();

    if (deployError) {
      // If it's a column mismatch, try with just one column name
      if (deployError.message?.includes('column') || deployError.code === '42703') {
        // Try with just 'active' column (newer schema)
        const { data: deploy2, error: deployError2 } = await supabase
          .from('deployed_projects')
          .insert({ name, description: description || '', active: true })
          .select('id')
          .single();

        if (deployError2) {
          // Try with just 'is_active' column (older schema)
          const { data: deploy3, error: deployError3 } = await supabase
            .from('deployed_projects')
            .insert({ name, description: description || '', is_active: true })
            .select('id')
            .single();

          if (deployError3) {
            if (deployError3.code === '42P01') {
              return json({
                error: 'deployed_projects table not found. Please run the migration SQL first.',
                migrationNeeded: true,
              }, { status: 500 });
            }
            return json({ error: deployError3.message }, { status: 500 });
          }

          return await insertFilesAndReturn(supabase, deploy3.id, files, request);
        }

        return await insertFilesAndReturn(supabase, deploy2.id, files, request);
      }

      if (deployError.code === '42P01') {
        return json({
          error: 'deployed_projects table not found. Please run the migration SQL first.',
          migrationNeeded: true,
        }, { status: 500 });
      }
      return json({ error: deployError.message }, { status: 500 });
    }

    return await insertFilesAndReturn(supabase, deploy.id, files, request);
  }

  if (deployAction === 'update') {
    // Update an existing deployed project (reuse same URL)
    if (!deployId || !files || files.length === 0) {
      return json({ error: 'Deploy ID and files are required for update' }, { status: 400 });
    }

    // Verify the deploy exists
    const { data: existingDeploy, error: fetchError } = await supabase
      .from('deployed_projects')
      .select('id, name, is_active, active')
      .eq('id', deployId)
      .single();

    if (fetchError || !existingDeploy) {
      return json({ error: 'Deploy not found. It may have been deleted.' }, { status: 404 });
    }

    if (!getIsActive(existingDeploy)) {
      return json({ error: 'This deploy has been deactivated and cannot be updated.' }, { status: 410 });
    }

    // Delete all old files for this deploy
    const { error: deleteFilesError } = await supabase
      .from('deployed_project_files')
      .delete()
      .eq('deploy_id', deployId);

    if (deleteFilesError) {
      return json({ error: `Failed to clear old files: ${deleteFilesError.message}` }, { status: 500 });
    }

    // Insert new files in batches
    const filesToInsert = files.map((f: { path: string; content: string }) => ({
      deploy_id: deployId,
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
        return json({ error: `Failed to save files: ${filesError.message}` }, { status: 500 });
      }
    }

    // Update the deploy record (name + updated_at)
    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    await supabase
      .from('deployed_projects')
      .update(updateData)
      .eq('id', deployId);

    // Return the same URL
    const origin = new URL(request.url).origin;
    const viewUrl = `${origin}/view/${deployId}`;

    return json({
      success: true,
      deployId,
      viewUrl,
    });
  }

  if (deployAction === 'deactivate') {
    // Deactivate a deploy — update both column name variants
    const updateData: Record<string, any> = {
      is_active: false,
      active: false,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('deployed_projects')
      .update(updateData)
      .eq('id', deployId);

    if (error) {
      // Try with just 'active' column
      if (error.message?.includes('column') || error.code === '42703') {
        const { error: error2 } = await supabase
          .from('deployed_projects')
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq('id', deployId);

        if (error2) {
          const { error: error3 } = await supabase
            .from('deployed_projects')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', deployId);

          if (error3) {
            return json({ error: error3.message }, { status: 500 });
          }
        }
      } else {
        return json({ error: error.message }, { status: 500 });
      }
    }

    return json({ success: true });
  }

  return json({ error: 'Invalid action' }, { status: 400 });
}

/**
 * Helper: Insert files for a deploy and return the view URL.
 * Extracted to avoid code duplication between create paths.
 */
async function insertFilesAndReturn(
  supabase: ReturnType<typeof createClient>,
  deployId: string,
  files: { path: string; content: string }[],
  request: Request,
) {
  // Insert files in batches
  const filesToInsert = files.map((f: { path: string; content: string }) => ({
    deploy_id: deployId,
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
      await supabase.from('deployed_projects').delete().eq('id', deployId);
      return json({ error: `Failed to save files: ${filesError.message}` }, { status: 500 });
    }
  }

  // Generate the view URL
  const origin = new URL(request.url).origin;
  const viewUrl = `${origin}/view/${deployId}`;

  return json({
    success: true,
    deployId,
    viewUrl,
  });
}
