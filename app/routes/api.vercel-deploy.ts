import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';

interface DeployFile {
  path: string;
  content: string;
}

interface DeployBody {
  token: string;
  projectName?: string;
  framework?: string;
  files: DeployFile[];
}

const VERCEL_API = 'https://api.vercel.com/v13';

function encodeFile(content: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(content, 'utf-8').toString('base64');
  }
  const bytes = new TextEncoder().encode(content);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
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
  const { projectName, framework, files } = body;

  if (!token) return json({ error: 'Vercel token is required. Set VERCEL_TOKEN env var or provide in settings.' }, { status: 400 });
  if (!Array.isArray(files) || files.length === 0) return json({ error: 'No files to deploy' }, { status: 400 });

  try {
    // Validate token by fetching user info
    const meRes = await fetch(`${VERCEL_API}/user`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!meRes.ok) {
      const t = await meRes.text();
      return json({ error: `Invalid Vercel token: ${t}` }, { status: 401 });
    }

    // Get or list teams
    const teamsRes = await fetch(`${VERCEL_API}/teams`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    let teamId = '';
    if (teamsRes.ok) {
      const teams = (await teamsRes.json()) as { id: string }[];
      if (teams.length > 0) {
        teamId = teams[0].id;
      }
    }

    const teamQuery = teamId ? `?teamId=${teamId}` : '';

    // Create a new project
    const projectSlug = projectName
      ? projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 60)
      : `omni-builder-${Date.now().toString(36)}`;

    const createProjectBody: Record<string, unknown> = {
      name: projectSlug,
      framework: framework || 'vite',
    };

    const createRes = await fetch(`${VERCEL_API}/projects${teamQuery}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(createProjectBody),
    });

    let projectId = '';
    let projectUrl = '';

    if (createRes.ok) {
      const projectData = (await createRes.json()) as { id: string; alias?: string[] };
      projectId = projectData.id;
      // Vercel URLs are typically <project-name>.vercel.app
      projectUrl = `https://${projectSlug}.vercel.app`;
    } else {
      // Project might already exist — try to get it
      const listRes = await fetch(`${VERCEL_API}/projects${teamQuery}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (listRes.ok) {
        const projectList = (await listRes.json()) as { id: string; name: string; alias?: string[] }[];
        const existing = projectList.find((p) => p.name === projectSlug);
        if (existing) {
          projectId = existing.id;
          projectUrl = existing.alias?.[0] || `https://${projectSlug}.vercel.app`;
        }
      }
    }

    if (!projectId) {
      const t = await createRes.text();
      return json({ error: `Failed to create Vercel project: ${t}` }, { status: createRes.status });
    }

    // Upload files as a deployment
    const vercelFiles: Record<string, { file: string; data: string; encoding: string }> = {};
    for (const f of files) {
      const cleanPath = f.path.replace(/^\/+/, '');
      vercelFiles[cleanPath] = {
        file: cleanPath,
        data: encodeFile(f.content),
        encoding: 'base64',
      };
    }

    const deployRes = await fetch(`${VERCEL_API}/deployments${teamQuery}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: projectSlug,
        project: projectId,
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
      projectId,
      projectName: projectSlug,
      deployId: deployData.id,
      url: deployData.url || projectUrl,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown deploy error' }, { status: 500 });
  }
}
