import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';

interface DeployFile {
  path: string;
  content: string;
  /** If true, content is base64-encoded binary data */
  binary?: boolean;
}

interface DeployBody {
  token?: string;
  siteId?: string;
  siteName?: string;
  files: DeployFile[];
}

const NETLIFY_API = 'https://api.netlify.com/api/v1';

/**
 * Compute SHA1 hash using Web Crypto API (available in Cloudflare Workers).
 * Netlify uses SHA1 hashes to identify files — we send the hash in the deploy
 * creation, then upload only the files Netlify doesn't already have.
 */
async function sha1(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

  let body: DeployBody;
  try {
    body = (await request.json()) as DeployBody;
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { siteId, siteName, files } = body;

  // Resolve token: use client-provided token, or fall back to server's NETLIFY_DEFAULT_API_KEY
  const env = (context as any)?.cloudflare?.env || {};
  const token = body.token || env.NETLIFY_DEFAULT_API_KEY || '';

  if (!token) return json({ error: 'Netlify token is required. Configure it in Settings or set NETLIFY_DEFAULT_API_KEY env var.' }, { status: 400 });
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
      const name = siteName || `omni-builder-${Date.now().toString(36)}`;
      const createRes = await fetch(`${NETLIFY_API}/sites`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
        }),
      });
      if (!createRes.ok) {
        const t = await createRes.text();
        return json({ error: `Failed to create Netlify site: ${t}` }, { status: createRes.status });
      }
      const siteData = (await createRes.json()) as { id: string; ssl_url?: string; url?: string; name?: string };
      targetSiteId = siteData.id;
      siteUrl = siteData.ssl_url || siteData.url || '';
    } else {
      // Fetch existing site info for URL
      const siteRes = await fetch(`${NETLIFY_API}/sites/${targetSiteId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (siteRes.ok) {
        const siteData = (await siteRes.json()) as { ssl_url?: string; url?: string; name?: string };
        siteUrl = siteData.ssl_url || siteData.url || '';
      }
    }

    // ── Prepare files ──
    // Inject _redirects for SPA routing if not present.
    // This prevents 404 on client-side routes like /about, /dashboard, etc.
    const allFiles = [...files];
    const hasRedirects = files.some((f) => f.path.replace(/^\/+/, '') === '_redirects');

    if (!hasRedirects) {
      allFiles.push({
        path: '_redirects',
        content: '/*    /index.html   200',
      });
    }

    // Inject a netlify.toml if not present (for additional config)
    const hasNetlifyToml = files.some((f) => f.path.replace(/^\/+/, '') === 'netlify.toml');
    if (!hasNetlifyToml) {
      allFiles.push({
        path: 'netlify.toml',
        content: [
          '[build]',
          '  publish = "."',
          '',
          '[[redirects]]',
          '  from = "/*"',
          '  to = "/index.html"',
          '  status = 200',
        ].join('\n'),
      });
    }

    // ── Step 1: Compute SHA1 hashes for all files ──
    // Netlify's deploy API requires SHA1 hashes to determine which files
    // need uploading (files already on the site with matching hashes are skipped)
    const fileEntries: { path: string; content: string; hash: string; binary?: boolean }[] = [];
    const filesMap: Record<string, string> = {}; // hash -> path (for quick lookup)
    const filesObject: Record<string, string> = {}; // path -> hash (for deploy creation)

    for (const f of allFiles) {
      const cleanPath = f.path.replace(/^\/+/, '');
      // For binary files, decode base64 to binary first, then hash the raw bytes
      let dataToHash: Uint8Array;
      if (f.binary) {
        const binaryStr = atob(f.content);
        dataToHash = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          dataToHash[i] = binaryStr.charCodeAt(i);
        }
      } else {
        dataToHash = new TextEncoder().encode(f.content);
      }
      const hashBuffer = await crypto.subtle.digest('SHA-1', dataToHash);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      fileEntries.push({ path: cleanPath, content: f.content, hash, binary: f.binary });
      filesMap[hash] = cleanPath;
      filesObject[cleanPath] = hash;
    }

    // ── Step 2: Create a deploy with file hashes ──
    // The Netlify API expects: { files: { "path": "sha1hash" }, ... }
    const deployRes = await fetch(`${NETLIFY_API}/sites/${targetSiteId}/deploys`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: filesObject,
        title: `Omni-Builder deploy - ${new Date().toISOString()}`,
      }),
    });

    if (!deployRes.ok) {
      const t = await deployRes.text();
      return json({ error: `Deploy creation failed: ${t}` }, { status: deployRes.status });
    }

    const deployData = (await deployRes.json()) as {
      id: string;
      deploy_ssl_url?: string;
      ssl_url?: string;
      required?: string[]; // Array of SHA1 hashes that Netlify needs uploaded
    };

    // ── Step 3: Upload files that Netlify doesn't already have ──
    // deployData.required contains the list of SHA1 hashes Netlify needs.
    // We upload each required file via PUT to /deploys/{id}/files/{sha1hash}
    const requiredHashes = new Set(deployData.required || []);

    if (requiredHashes.size > 0) {
      const filesToUpload = fileEntries.filter((e) => requiredHashes.has(e.hash));

      // Upload each required file
      for (const entry of filesToUpload) {
        let uploadBody: ArrayBuffer | string;
        let contentType: string;

        if (entry.binary) {
          // Decode base64 to binary for upload
          const binaryStr = atob(entry.content);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          uploadBody = bytes.buffer;
          contentType = 'application/octet-stream';
        } else {
          uploadBody = entry.content;
          contentType = 'application/octet-stream';
        }

        const uploadRes = await fetch(`${NETLIFY_API}/deploys/${deployData.id}/files/${entry.hash}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': contentType,
          },
          body: uploadBody,
        });

        if (!uploadRes.ok) {
          const t = await uploadRes.text();
          console.error(`Failed to upload file ${entry.path}: ${t}`);
          // Continue uploading other files — don't fail the whole deploy
        }
      }
    }

    // ── Step 4: Wait for deploy to complete (poll up to 60 seconds) ──
    let deployStatus = 'uploading';
    let attempts = 0;
    const maxAttempts = 30; // 30 * 2s = 60s

    while (attempts < maxAttempts && (deployStatus === 'uploading' || deployStatus === 'processing')) {
      await new Promise((r) => setTimeout(r, 2000));
      attempts++;

      try {
        const statusRes = await fetch(`${NETLIFY_API}/deploys/${deployData.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (statusRes.ok) {
          const statusData = (await statusRes.json()) as {
            state: string;
            deploy_ssl_url?: string;
            ssl_url?: string;
            error_message?: string;
          };
          deployStatus = statusData.state;

          if (deployStatus === 'ready') {
            const finalUrl = statusData.deploy_ssl_url || statusData.ssl_url || deployData.deploy_ssl_url || siteUrl || `https://${targetSiteId}.netlify.app`;
            return json({
              success: true,
              siteId: targetSiteId,
              deployId: deployData.id,
              url: finalUrl,
            });
          }

          if (deployStatus === 'error') {
            return json({ error: `Deploy failed: ${statusData.error_message || 'Unknown error'}` }, { status: 500 });
          }
        }
      } catch {
        // Continue polling on network errors
      }
    }

    // If we timed out, return the deploy info anyway (it may still be processing)
    const resultUrl = deployData.deploy_ssl_url || siteUrl || `https://${targetSiteId}.netlify.app`;
    return json({
      success: true,
      siteId: targetSiteId,
      deployId: deployData.id,
      url: resultUrl,
      warning: 'Deploy is still processing. The site may take a moment to be live.',
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown deploy error' }, { status: 500 });
  }
}
