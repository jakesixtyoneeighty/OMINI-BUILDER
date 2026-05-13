import { type ActionFunctionArgs, type LoaderFunctionArgs, json } from '@remix-run/cloudflare';

interface DeployFile {
  path: string;
  content: string;
  /** If true, content is already base64-encoded binary data */
  binary?: boolean;
}

interface DeployBody {
  token: string;
  projectName?: string;
  projectId?: string;
  framework?: string;
  files: DeployFile[];
}

const VERCEL_API = 'https://api.vercel.com';
// Vercel REST API uses different versions per endpoint:
// v2 = user, teams | v9 = projects | v13 = deployments

function encodeFile(content: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(content, 'utf-8').toString('base64');
  }
  const bytes = new TextEncoder().encode(content);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/**
 * GET handler: Poll Vercel deployment status
 * Query params: deployId, token, teamId (optional)
 */
export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const deployId = url.searchParams.get('deployId');
  const tokenParam = url.searchParams.get('token');
  const teamId = url.searchParams.get('teamId') || '';

  if (!deployId || !tokenParam) {
    return json({ error: 'Missing deployId or token' }, { status: 400 });
  }

  // Fall back to env var for token
  let env: Record<string, any> = {};
  if ((context as any)?.cloudflare?.env) env = (context as any).cloudflare.env;
  else if ((context as any)?.env) env = (context as any).env;
  else if (typeof process !== 'undefined' && process.env) env = process.env;

  const token = tokenParam || env.VERCEL_TOKEN || '';
  const teamQuery = teamId ? `&teamId=${teamId}` : '';

  try {
    const checkRes = await fetch(`${VERCEL_API}/v13/deployments/${deployId}?${teamQuery}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!checkRes.ok) {
      const t = await checkRes.text();
      return json({ error: `Failed to check deployment: ${t}` }, { status: checkRes.status });
    }

    const deployData = (await checkRes.json()) as {
      id: string;
      state: string;
      readyState?: string;
      url?: string;
      alias?: string[];
      building?: boolean;
      error?: { message?: string };
    };

    // Vercel deployment states: BUILDING, READY, ERROR, QUEUED, CANCELED, INITIALIZING
    const state = deployData.state || deployData.readyState || '';
    const isReady = state === 'READY';
    const isError = state === 'ERROR' || state === 'CANCELED';
    const isBuilding = state === 'BUILDING' || state === 'QUEUED' || state === 'INITIALIZING';

    return json({
      id: deployData.id,
      state,
      isReady,
      isError,
      isBuilding,
      url: deployData.url ? `https://${deployData.url}` : (deployData.alias?.[0] || ''),
      errorMessage: deployData.error?.message || '',
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown error checking deployment' }, { status: 500 });
  }
}

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

  let body: DeployBody;
  try {
    body = (await request.json()) as DeployBody;
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Use token from request body, or fall back to VERCEL_TOKEN env var
  let env: Record<string, any> = {};
  if ((context as any)?.cloudflare?.env) env = (context as any).cloudflare.env;
  else if ((context as any)?.env) env = (context as any).env;
  else if (typeof process !== 'undefined' && process.env) env = process.env;

  const token = body.token || env.VERCEL_TOKEN || '';
  const { projectName, projectId: existingProjectId, framework, files } = body;

  if (!token) return json({ error: 'Vercel token is required. Set VERCEL_TOKEN env var or provide in settings.' }, { status: 400 });
  if (!Array.isArray(files) || files.length === 0) return json({ error: 'No files to deploy' }, { status: 400 });

  try {
    // Validate token by fetching user info
    const meRes = await fetch(`${VERCEL_API}/v2/user`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!meRes.ok) {
      const t = await meRes.text();
      return json({ error: `Invalid Vercel token: ${t}` }, { status: 401 });
    }

    // Get or list teams
    const teamsRes = await fetch(`${VERCEL_API}/v2/teams`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    let teamId = '';
    if (teamsRes.ok) {
      const teamsData = (await teamsRes.json()) as { teams?: { id: string }[] };
      if (teamsData.teams && teamsData.teams.length > 0) {
        teamId = teamsData.teams[0].id;
      }
    }

    const teamQuery = teamId ? `?teamId=${teamId}` : '';

    let vercelProjectId = existingProjectId || '';
    let projectUrl = '';
    let projectSlug = '';

    // ── If we already have a project ID, verify it exists and reuse it ──
    if (vercelProjectId) {
      const getRes = await fetch(`${VERCEL_API}/v9/projects/${vercelProjectId}${teamQuery}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (getRes.ok) {
        const projectData = (await getRes.json()) as { id: string; name: string; alias?: string[] };
        projectSlug = projectData.name;
        projectUrl = `https://${projectSlug}.vercel.app`;
      } else {
        // Project ID no longer valid, clear it and create new
        vercelProjectId = '';
      }
    }

    // ── If we have a project name but no ID, try to find the existing project ──
    if (!vercelProjectId && projectName) {
      projectSlug = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 60);

      // Try to find existing project by name
      const listRes = await fetch(`${VERCEL_API}/v9/projects${teamQuery}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (listRes.ok) {
        const listData = (await listRes.json()) as { projects?: { id: string; name: string; alias?: string[] }[] };
        const projectList = listData.projects || [];
        const existing = projectList.find((p) => p.name === projectSlug);
        if (existing) {
          vercelProjectId = existing.id;
          projectUrl = existing.alias?.[0] || `https://${projectSlug}.vercel.app`;
        }
      }
    }

    // ── If still no project, create a new one ──
    if (!vercelProjectId) {
      projectSlug = projectName
        ? projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 60)
        : `omni-builder-${Date.now().toString(36)}`;

      const createProjectBody: Record<string, unknown> = {
        name: projectSlug,
        framework: framework || 'vite',
      };

      const createRes = await fetch(`${VERCEL_API}/v9/projects${teamQuery}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(createProjectBody),
      });

      if (createRes.ok) {
        const projectData = (await createRes.json()) as { id: string; alias?: string[] };
        vercelProjectId = projectData.id;
        projectUrl = `https://${projectSlug}.vercel.app`;
      } else {
        const t = await createRes.text();
        return json({ error: `Failed to create Vercel project: ${t}` }, { status: createRes.status });
      }
    }

    // ── Upload files as a deployment ──
    const vercelFiles: Record<string, { file: string; data: string; encoding: string }> = {};
    for (const f of files) {
      const cleanPath = f.path.replace(/^\/+/, '');
      // If the file is already base64-encoded (binary), use the content directly.
      // Otherwise, encode it from UTF-8 text to base64.
      const base64Data = f.binary ? f.content : encodeFile(f.content);
      vercelFiles[cleanPath] = {
        file: cleanPath,
        data: base64Data,
        encoding: 'base64',
      };
    }

    const deployRes = await fetch(`${VERCEL_API}/v13/deployments${teamQuery}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: projectSlug,
        project: vercelProjectId,
        files: Object.values(vercelFiles),
        target: 'production',
      }),
    });

    if (!deployRes.ok) {
      const t = await deployRes.text();
      return json({ error: `Deploy failed: ${t}` }, { status: deployRes.status });
    }

    const deployData = (await deployRes.json()) as { id: string; url?: string };

    return json({
      success: true,
      projectId: vercelProjectId,
      projectName: projectSlug,
      deployId: deployData.id,
      teamId,
      url: deployData.url ? `https://${deployData.url}` : projectUrl,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown deploy error' }, { status: 500 });
  }
}
