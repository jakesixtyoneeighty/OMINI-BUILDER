import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';

interface DeployFile {
  path: string;
  content: string;
  /** If true, content is base64-encoded binary data */
  binary?: boolean;
}

interface DeployBody {
  projectName?: string;
  files: DeployFile[];
}

const CF_API = 'https://api.cloudflare.com/client/v4';

/**
 * Build the multipart/form-data body for Cloudflare Pages Direct Upload.
 *
 * The Cloudflare Pages API expects:
 * - A "manifest" field: JSON string mapping file paths to their SHA1 hashes
 *   e.g. {"index.html": "abc123...", "style.css": "def456..."}
 * - File contents as form entries, where each entry's key is the file path
 *   and the value is the file content as a Blob
 *
 * See: https://developers.cloudflare.com/pages/platform/direct-upload/
 */
async function buildMultipartBody(files: DeployFile[]): Promise<{ formData: FormData; manifest: Record<string, string> }> {
  const formData = new FormData();
  const manifest: Record<string, string> = {};

  for (const f of files) {
    const cleanPath = f.path.replace(/^\/+/, '');

    let fileData: Uint8Array;
    if (f.binary) {
      // Decode base64 content back to binary
      const binaryStr = atob(f.content);
      fileData = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        fileData[i] = binaryStr.charCodeAt(i);
      }
    } else {
      fileData = new TextEncoder().encode(f.content);
    }

    // Compute SHA1 from the actual file bytes (not the base64 string)
    const hashBuffer = await crypto.subtle.digest('SHA-1', fileData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    manifest[cleanPath] = hash;

    // Add file content as a Blob with the path as the field name
    formData.append(cleanPath, new Blob([fileData], { type: 'application/octet-stream' }), cleanPath);
  }

  // The manifest must be a JSON string in a field called "manifest"
  formData.append('manifest', JSON.stringify(manifest));

  return { formData, manifest };
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
          'Cloudflare Pages deploy not configured on server. Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID environment variables in the Cloudflare Pages dashboard.',
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
    const allFiles = [...files];
    const hasRedirects = files.some((f) => f.path.replace(/^\/+/, '') === '_redirects');
    const hasIndexHtml = files.some((f) => f.path.replace(/^\/+/, '') === 'index.html');

    // Inject _redirects for SPA routing if not already present
    // Only add when there's an index.html (i.e., built project or static site)
    // This ensures client-side routing works (e.g., React Router)
    if (!hasRedirects && hasIndexHtml) {
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
          '  Referrer-Policy: strict-origin-when-cross-origin',
        ].join('\n'),
      });
    }

    // ── Step 4: Build multipart body with manifest + files ──
    // Cloudflare Pages Direct Upload requires:
    //   - "manifest" field: JSON mapping file_path -> sha1_hash
    //   - File contents as separate form fields (key = file path)
    const { formData } = await buildMultipartBody(allFiles);

    // ── Step 5: Deploy files via Direct Upload ──
    // POST /accounts/{account_id}/pages/projects/{project_name}/deployments
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
        latest_stage?: { name: string; status: string };
      };
    };

    // Build the final URL
    // Cloudflare Pages URL format: https://<project-subdomain>.pages.dev
    // NOTE: The Cloudflare API's `subdomain` field may already include ".pages.dev"
    // (e.g., "my-project.pages.dev"), so we must avoid duplicating it.
    const cleanSubdomain = projectSubdomain.replace(/\.pages\.dev$/i, '');
    const siteUrl = `https://${cleanSubdomain}.pages.dev`;

    // ── Step 6: Wait for deployment to be ready (poll up to 60s) ──
    let deployReady = false;
    let attempts = 0;
    const maxAttempts = 30; // 30 * 2s = 60s
    const deployId = deployData.result?.id || '';

    // Check if already ready from the initial response
    const initialStage = deployData.result?.latest_stage;
    if (initialStage?.name === 'deploy' && initialStage?.status === 'success') {
      deployReady = true;
    }

    while (attempts < maxAttempts && !deployReady) {
      await new Promise((r) => setTimeout(r, 2000));
      attempts++;

      try {
        const statusRes = await fetch(
          `${CF_API}/accounts/${accountId}/pages/projects/${name}/deployments/${deployId}`,
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

    // Prefer the URL returned by the Cloudflare deploy API as it is guaranteed correct.
    // Fall back to our constructed siteUrl only if the API doesn't provide one.
    const finalUrl = deployData.result?.url || siteUrl;

    return json({
      success: true,
      projectName: name,
      subdomain: cleanSubdomain,
      url: finalUrl,
      siteUrl,
      deployUrl: deployData.result?.url || siteUrl,
      deployId,
      processing: !deployReady,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown deploy error' }, { status: 500 });
  }
}
