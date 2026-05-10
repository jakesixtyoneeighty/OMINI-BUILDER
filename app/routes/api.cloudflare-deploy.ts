import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';

interface DeployFile {
  path: string;
  content: string;
}

interface DeployBody {
  projectName?: string;
  files: DeployFile[];
}

const CF_API = 'https://api.cloudflare.com/client/v4';

/**
 * Build a multipart/form-data body for Cloudflare Pages Direct Upload.
 * Each file is added as a separate form field with its relative path.
 * Cloudflare Pages API expects:
 * - File contents as Blob/File entries with the key matching the file path
 * - The project name in the URL
 */
function buildMultipartBody(files: DeployFile[]): FormData {
  const formData = new FormData();

  for (const f of files) {
    const cleanPath = f.path.replace(/^\/+/, '');
    // Cloudflare Pages expects each file as a Blob with the path as the field name
    formData.append('file', new Blob([f.content], { type: 'application/octet-stream' }), cleanPath);
  }

  return formData;
}

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

  let body: DeployBody;
  try {
    body = (await request.json()) as DeployBody;
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { projectName, files } = body;

  if (!Array.isArray(files) || files.length === 0) {
    return json({ error: 'No files to deploy' }, { status: 400 });
  }

  // Resolve Cloudflare credentials from server environment
  const env = (context as any)?.cloudflare?.env || {};
  const apiToken = env.CLOUDFLARE_API_TOKEN || '';
  const accountId = env.CLOUDFLARE_ACCOUNT_ID || '';

  if (!apiToken || !accountId) {
    return json(
      {
        error:
          'Cloudflare Pages deploy not configured on server. Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID environment variables.',
      },
      { status: 500 },
    );
  }

  try {
    // Generate a clean project name for Cloudflare Pages
    const name = (projectName || `omni-${Date.now().toString(36)}`)
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 28);

    // ── Step 1: Check if project already exists ──
    let projectSubdomain = '';
    let projectExists = false;

    const checkRes = await fetch(`${CF_API}/accounts/${accountId}/pages/projects/${name}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    if (checkRes.ok) {
      const checkData = (await checkRes.json()) as {
        result?: { subdomain?: string; domains?: string[] };
      };
      projectExists = true;
      projectSubdomain = checkData.result?.subdomain || name;
    }

    // ── Step 2: Ensure project exists (create if needed) ──
    if (!projectExists) {
      const createRes = await fetch(`${CF_API}/accounts/${accountId}/pages/projects`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          production_branch: 'main',
        }),
      });

      if (!createRes.ok) {
        const t = await createRes.text();
        return json({ error: `Failed to create Cloudflare Pages project: ${t}` }, { status: createRes.status });
      }

      const createData = (await createRes.json()) as {
        result?: { subdomain?: string; domains?: string[] };
      };
      projectSubdomain = createData.result?.subdomain || name;
    }

    // ── Step 3: Prepare files ──
    // Inject _redirects for SPA routing if not already present
    const allFiles = [...files];
    const hasRedirects = files.some((f) => f.path.replace(/^\/+/, '') === '_redirects');

    if (!hasRedirects) {
      allFiles.push({
        path: '_redirects',
        content: '/*    /index.html   200',
      });
    }

    // Inject _headers for security and caching
    const hasHeaders = files.some((f) => f.path.replace(/^\/+/, '') === '_headers');
    if (!hasHeaders) {
      allFiles.push({
        path: '_headers',
        content: [
          '/*',
          '  X-Content-Type-Options: nosniff',
          '  X-Frame-Options: DENY',
          '  Referrer-Policy: strict-origin-when-cross-origin',
        ].join('\n'),
      });
    }

    // ── Step 4: Deploy files via Direct Upload ──
    // POST /accounts/{account_id}/pages/projects/{project_name}/deployments
    // Body: multipart/form-data with all files
    const formData = buildMultipartBody(allFiles);

    const deployRes = await fetch(`${CF_API}/accounts/${accountId}/pages/projects/${name}/deployments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
      body: formData as any,
    });

    if (!deployRes.ok) {
      const t = await deployRes.text();
      return json({ error: `Deploy failed: ${t}` }, { status: deployRes.status });
    }

    const deployData = (await deployRes.json()) as {
      result?: {
        id?: string;
        url?: string;
        stages?: { name: string; status: string }[];
      };
    };

    // Build the final URL
    // Cloudflare Pages URL format: https://<project-subdomain>.pages.dev
    const siteUrl = `https://${projectSubdomain}.pages.dev`;
    const deployUrl = deployData.result?.url || siteUrl;

    // ── Step 5: Wait for deployment to be ready (poll up to 60s) ──
    let deployReady = false;
    let attempts = 0;
    const maxAttempts = 30; // 30 * 2s = 60s

    while (attempts < maxAttempts && !deployReady) {
      await new Promise((r) => setTimeout(r, 2000));
      attempts++;

      try {
        const statusRes = await fetch(
          `${CF_API}/accounts/${accountId}/pages/projects/${name}/deployments/${deployData.result?.id}`,
          {
            headers: { Authorization: `Bearer ${apiToken}` },
          },
        );

        if (statusRes.ok) {
          const statusData = (await statusRes.json()) as {
            result?: {
              latest_stage?: { name: string; status: string };
              stages?: { name: string; status: string }[];
            };
          };

          const latestStage = statusData.result?.latest_stage;
          if (latestStage?.name === 'deploy' && latestStage?.status === 'success') {
            deployReady = true;
          } else if (latestStage?.status === 'failure') {
            return json({ error: 'Deploy failed on Cloudflare Pages' }, { status: 500 });
          }
        }
      } catch {
        // Continue polling on network errors
      }
    }

    return json({
      success: true,
      projectName: name,
      subdomain: projectSubdomain,
      url: siteUrl,
      deployUrl,
      deployId: deployData.result?.id || '',
      processing: !deployReady,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown deploy error' }, { status: 500 });
  }
}
