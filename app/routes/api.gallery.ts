import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { createClient } from '@supabase/supabase-js';

// Server-side Supabase using context.cloudflare.env (the correct way for Remix on Cloudflare Pages)
function getServerSupabase(context: any) {
  // Try multiple env access patterns for Cloudflare Pages
  let env: Record<string, any> = {};

  if (context?.cloudflare?.env) {
    env = context.cloudflare.env;
  } else if (context?.env) {
    env = context.env;
  } else if (typeof process !== 'undefined' && process.env) {
    env = process.env;
  }

  const url = env.SUPABASE_URL || '';
  // Use service role key to bypass RLS (gallery is public), fallback to anon key
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || '';

  if (!url || !key) {
    console.error('[Gallery API] Database not configured. Missing env vars:', {
      hasUrl: !!url,
      hasKey: !!key,
      hasContext: !!context,
      hasCloudflareEnv: !!context?.cloudflare?.env,
      hasContextEnv: !!context?.env,
    });
    return null;
  }

  const opts: any = {};
  // If using service role key, disable session persistence
  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    opts.auth = { persistSession: false, autoRefreshToken: false };
  }

  return createClient(url, key, opts);
}

// GET /api/gallery - List published gallery projects
export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const search = url.searchParams.get('search');
  const sort = url.searchParams.get('sort') || 'newest';
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  const supabase = getServerSupabase(context);
  if (!supabase) {
    return json({ error: 'Database not configured' }, { status: 500 });
  }

  // Build full query with all filters
  function buildQuery(includeCoverAndLogo: boolean) {
    const columns = includeCoverAndLogo
      ? 'id, author_id, author_name, name, description, thumbnail, cover_image, logo, tags, category, likes, views, is_featured, published_at'
      : 'id, author_id, author_name, name, description, thumbnail, tags, category, likes, views, is_featured, published_at';

    let q = supabase
      .from('gallery_projects')
      .select(columns)
      .eq('is_published', true);

    if (category && category !== 'all') {
      q = q.eq('category', category);
    }
    if (search) {
      q = q.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }
    switch (sort) {
      case 'popular':
        q = q.order('likes', { ascending: false });
        break;
      case 'featured':
        q = q.eq('is_featured', true).order('published_at', { ascending: false });
        break;
      case 'newest':
      default:
        q = q.order('published_at', { ascending: false });
        break;
    }
    q = q.range(offset, offset + limit - 1);
    return q;
  }

  // Try with cover_image/logo first, fallback without if columns don't exist
  let { data: projects, error } = await buildQuery(true);

  if (error && (error.message.includes('cover_image') || error.message.includes('logo') || error.code === '42703')) {
    console.warn('[Gallery API] cover_image/logo columns not found, using fallback. Run the migration SQL in Supabase SQL Editor.');
    ({ data: projects, error } = await buildQuery(false));
  }

  if (error) {
    return json({ error: error.message }, { status: 500 });
  }

  // Get total count
  let countQuery = supabase
    .from('gallery_projects')
    .select('id', { count: 'exact', head: true })
    .eq('is_published', true);

  if (category && category !== 'all') {
    countQuery = countQuery.eq('category', category);
  }
  if (search) {
    countQuery = countQuery.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const { count } = await countQuery;

  return json({
    projects: projects || [],
    total: count || 0,
    limit,
    offset,
  });
}

// POST /api/gallery - Publish a project to gallery
export async function action({ request, context }: ActionFunctionArgs) {
  const supabase = getServerSupabase(context);
  if (!supabase) {
    return json({ error: 'Database not configured' }, { status: 500 });
  }

  const body = await request.json();
  const { action: galleryAction, token, projectData, projectId } = body;

  if (galleryAction === 'publish') {
    // Publish a new project to gallery
    const { name, description, thumbnail, coverImage, logo, tags, category, authorName, authorEmail, files } = projectData || {};

    if (!name || !files || files.length === 0) {
      return json({ error: 'Name and files are required' }, { status: 400 });
    }

    // Create the gallery project - try with cover_image/logo, fallback without
    let insertData: Record<string, any> = {
      author_name: authorName || 'Anonymous',
      author_email: authorEmail || null,
      name,
      description: description || '',
      thumbnail: thumbnail || '',
      tags: tags || [],
      category: category || 'web-apps',
    };

    // Try with cover_image/logo first
    let { data: project, error: projectError } = await supabase
      .from('gallery_projects')
      .insert({
        ...insertData,
        cover_image: coverImage || '',
        logo: logo || '',
      })
      .select('id')
      .single();

    // If columns don't exist, retry without them
    if (projectError && (projectError.message.includes('cover_image') || projectError.message.includes('logo') || projectError.code === '42703')) {
      console.warn('[Gallery API] cover_image/logo columns not found, publishing without them.');
      ({ data: project, error: projectError } = await supabase
        .from('gallery_projects')
        .insert(insertData)
        .select('id')
        .single());
    }

    if (projectError) {
      return json({ error: projectError.message }, { status: 500 });
    }

    // Insert files
    const filesToInsert = files.map((f: { path: string; content: string; isBinary?: boolean }) => ({
      project_id: project.id,
      path: f.path,
      content: f.content,
      is_binary: f.isBinary || false,
    }));

    // Insert in batches of 100 to avoid payload size limits
    const batchSize = 100;
    for (let i = 0; i < filesToInsert.length; i += batchSize) {
      const batch = filesToInsert.slice(i, i + batchSize);
      const { error: filesError } = await supabase
        .from('gallery_project_files')
        .insert(batch);

      if (filesError) {
        // Clean up project if files fail
        await supabase.from('gallery_projects').delete().eq('id', project.id);
        return json({ error: `Failed to save files: ${filesError.message}` }, { status: 500 });
      }
    }

    return json({ success: true, projectId: project.id });
  }

  if (galleryAction === 'get') {
    // Get a specific gallery project with files
    // Try with cover_image/logo first
    let { data: project, error } = await supabase
      .from('gallery_projects')
      .select('id, author_id, author_name, name, description, thumbnail, cover_image, logo, tags, category, likes, views, published_at')
      .eq('id', projectId)
      .eq('is_published', true)
      .single();

    // Fallback without cover_image/logo if columns don't exist
    if (error && (error.message.includes('cover_image') || error.message.includes('logo') || error.code === '42703')) {
      ({ data: project, error } = await supabase
        .from('gallery_projects')
        .select('id, author_id, author_name, name, description, thumbnail, tags, category, likes, views, published_at')
        .eq('id', projectId)
        .eq('is_published', true)
        .single());
    }

    if (error || !project) {
      return json({ error: 'Project not found' }, { status: 404 });
    }

    // Increment views
    await supabase
      .from('gallery_projects')
      .update({ views: project.views + 1 })
      .eq('id', projectId);

    // Get files
    const { data: files } = await supabase
      .from('gallery_project_files')
      .select('path, content, is_binary')
      .eq('project_id', projectId);

    return json({
      project,
      files: files || [],
    });
  }

  if (galleryAction === 'like') {
    // Like/unlike a project
    const userId = body.userId;
    if (!userId) {
      return json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check if already liked
    const { data: existing } = await supabase
      .from('gallery_likes')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      // Unlike
      await supabase.from('gallery_likes').delete().eq('id', existing.id);

      // Decrement likes
      const { data: proj } = await supabase
        .from('gallery_projects')
        .select('likes')
        .eq('id', projectId)
        .single();

      if (proj && proj.likes > 0) {
        await supabase
          .from('gallery_projects')
          .update({ likes: proj.likes - 1 })
          .eq('id', projectId);
      }

      return json({ liked: false });
    } else {
      // Like
      await supabase.from('gallery_likes').insert({
        project_id: projectId,
        user_id: userId,
      });

      // Increment likes
      const { data: proj } = await supabase
        .from('gallery_projects')
        .select('likes')
        .eq('id', projectId)
        .single();

      if (proj) {
        await supabase
          .from('gallery_projects')
          .update({ likes: proj.likes + 1 })
          .eq('id', projectId);
      }

      return json({ liked: true });
    }
  }

  if (galleryAction === 'delete') {
    // Delete own gallery project
    const userId = body.userId;
    if (!userId) {
      return json({ error: 'Authentication required' }, { status: 401 });
    }

    const { error } = await supabase
      .from('gallery_projects')
      .delete()
      .eq('id', projectId)
      .eq('author_id', userId);

    if (error) {
      return json({ error: error.message }, { status: 500 });
    }

    return json({ success: true });
  }

  if (galleryAction === 'my') {
    // Get current user's gallery projects
    const userId = body.userId;
    if (!userId) {
      return json({ projects: [] });
    }

    // Try with cover_image/logo first
    let { data: projects, error } = await supabase
      .from('gallery_projects')
      .select('id, name, description, thumbnail, cover_image, logo, tags, category, likes, views, is_featured, is_published, published_at, created_at')
      .eq('author_id', userId)
      .order('created_at', { ascending: false });

    // Fallback without cover_image/logo
    if (error && (error.message.includes('cover_image') || error.message.includes('logo') || error.code === '42703')) {
      ({ data: projects, error } = await supabase
        .from('gallery_projects')
        .select('id, name, description, thumbnail, tags, category, likes, views, is_featured, is_published, published_at, created_at')
        .eq('author_id', userId)
        .order('created_at', { ascending: false }));
    }

    if (error) {
      return json({ error: error.message }, { status: 500 });
    }

    return json({ projects: projects || [] });
  }

  return json({ error: 'Invalid action' }, { status: 400 });
}
