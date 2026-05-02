import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';

interface DeployFile {
  path: string;
  content: string;
}

interface DeployBody {
  token: string;
  siteId?: string;
  files: DeployFile[];
}

const NETLIFY_API = 'https://api.netlify.com/api/v1';

function encodeFile(path: string, content: string): { path: string; content: string; encoding: string } {
  // Netlify deploy API expects base64 encoded content
  if (typeof Buffer !== 'undefined') {
    return { path, content: Buffer.from(content, 'utf-8').toString('base64'), encoding: 'base64' };
  }
  const bytes = new TextEncoder().encode(content);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return { path, content: btoa(bin), encoding: 'base64' };
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

  let body: DeployBody;
  try {
    body = (await request.json()) as DeployBody;
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { token, siteId, files } = body;

  if (!token) return json({ error: 'Netlify token is required' }, { status: 400 });
  if (!Array.isArray(files) || files.length === 0) return json({ error: 'No files to deploy' }, { status: 400 });

  try {
    // Validate token
    const meRes = await fetch(`${NETLIFY_API}/user`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!meRes.ok) {
      const t = await meRes.text();
      return json({ error: `Invalid Netlify token: ${t}` }, { status: 401 });
    }

    let targetSiteId = siteId;
    let siteUrl = '';

    // Create site if no siteId provided
    if (!targetSiteId) {
      const createRes = await fetch(`${NETLIFY_API}/sites`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `omni-builder-${Date.now().toString(36)}`,
          body: 'Deployed from Omni-Builder',
        }),
      });
      if (!createRes.ok) {
        const t = await createRes.text();
        return json({ error: `Failed to create Netlify site: ${t}` }, { status: createRes.status });
      }
      const siteData = (await createRes.json()) as { id: string; ssl_url?: string; url?: string };
      targetSiteId = siteData.id;
      siteUrl = siteData.ssl_url || siteData.url || '';
    } else {
      // Fetch existing site info for URL
      const siteRes = await fetch(`${NETLIFY_API}/sites/${targetSiteId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (siteRes.ok) {
        const siteData = (await siteRes.json()) as { ssl_url?: string; url?: string };
        siteUrl = siteData.ssl_url || siteData.url || '';
      }
    }

    // Upload files as a deploy
    const deployFiles: Record<string, { file: string; content: string; encoding: string }> = {};
    for (const f of files) {
      const cleanPath = f.path.replace(/^\/+/, '');
      // Netlify needs a "file" key (not "path") in the upload format
      const encoded = encodeFile(cleanPath, f.content);
      deployFiles[cleanPath] = { file: cleanPath, content: encoded.content, encoding: encoded.encoding };
    }

    // Create a deploy with all files
    const deployRes = await fetch(`${NETLIFY_API}/sites/${targetSiteId}/deploys`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: Object.fromEntries(
          Object.entries(deployFiles).map(([path, data]) => [path, data])
        ),
        title: `Omni-Builder deploy - ${new Date().toISOString()}`,
      }),
    });

    if (!deployRes.ok) {
      const t = await deployRes.text();
      return json({ error: `Deploy failed: ${t}` }, { status: deployRes.status });
    }

    const deployData = (await deployRes.json()) as { id: string; deploy_ssl_url?: string; ssl_url?: string };

    return json({
      success: true,
      siteId: targetSiteId,
      deployId: deployData.id,
      url: deployData.deploy_ssl_url || siteUrl || `https://${targetSiteId}.netlify.app`,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown deploy error' }, { status: 500 });
  }
}
