import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { createClient } from '@supabase/supabase-js';

// Server-side Supabase using environment variables from Cloudflare Pages
function getServerSupabase(request: Request) {
  // Try to get from env (Cloudflare Workers/Pages)
  const env = (request as any).env;
  const url = env?.SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key = env?.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

  if (!url || !key) {
    return null;
  }

  return createClient(url, key);
}

// GET /api/gallery - List published gallery projects
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const search = url.searchParams.get('search');
  const sort = url.searchParams.get('sort') || 'newest';
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  const supabase = getServerSupabase(request);
  if (!supabase) {
    return json({ error: 'Database not configured' }, { status: 500 });
  }

  let query = supabase
    .from('gallery_projects')
    .select('id, author_id, author_name, name, description, thumbnail, tags, category, likes, views, is_featured, published_at')
    .eq('is_published', true);

  if (category && category !== 'all') {
    query = query.eq('category', category);
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }

  // Sorting
  switch (sort) {
    case 'popular':
      query = query.order('likes', { ascending: false });
      break;
    case 'featured':
      query = query.eq('is_featured', true).order('published_at', { ascending: false });
      break;
    case 'newest':
    default:
      query = query.order('published_at', { ascending: false });
      break;
  }

  query = query.range(offset, offset + limit - 1);

  const { data: projects, error } = await query;

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
export async function action({ request }: ActionFunctionArgs) {
  const supabase = getServerSupabase(request);
  if (!supabase) {
    return json({ error: 'Database not configured' }, { status: 500 });
  }

  const body = await request.json();
  const { action: galleryAction, token, projectData, projectId } = body;

  if (galleryAction === 'publish') {
    // Publish a new project to gallery
    const { name, description, thumbnail, tags, category, authorName, authorEmail, files } = projectData || {};

    if (!name || !files || files.length === 0) {
      return json({ error: 'Name and files are required' }, { status: 400 });
    }

    // Create the gallery project
    const { data: project, error: projectError } = await supabase
      .from('gallery_projects')
      .insert({
        author_name: authorName || 'Anonymous',
        author_email: authorEmail || null,
        name,
        description: description || '',
        thumbnail: thumbnail || '',
        tags: tags || [],
        category: category || 'web-apps',
      })
      .select('id')
      .single();

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
    const { data: project, error } = await supabase
      .from('gallery_projects')
      .select('id, author_id, author_name, name, description, thumbnail, tags, category, likes, views, published_at')
      .eq('id', projectId)
      .eq('is_published', true)
      .single();

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
      await supabase
        .from('gallery_projects')
        .update({ likes: supabase.rpc ? 0 : 0 }) // decrement handled below
        .eq('id', projectId);

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

    const { data: projects, error } = await supabase
      .from('gallery_projects')
      .select('id, name, description, thumbnail, tags, category, likes, views, is_featured, is_published, published_at, created_at')
      .eq('author_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return json({ error: error.message }, { status: 500 });
    }

    return json({ projects: projects || [] });
  }

  return json({ error: 'Invalid action' }, { status: 400 });
}
