import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';

interface DeployFile {
  path: string;
  content: string;
  /** If true, content is base64-encoded binary data */
  binary?: boolean;
}

interface DeployBody {
  projectId: string;
  region: string;
  serviceAccountKey: string;
  serviceName?: string;
  allowUnauthenticated?: boolean;
  files: DeployFile[];
}

// Google Cloud Run uses OAuth2 with service account JWT tokens
function base64url(data: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(data, 'utf-8').toString('base64url');
  }
  const bytes = new TextEncoder().encode(data);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Create a Google OAuth2 access token from a service account key
async function getAccessToken(serviceAccountKey: string): Promise<string> {
  const sa = JSON.parse(serviceAccountKey);
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: expiry,
  };

  // Build JWT manually
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const unsigned = `${headerB64}.${payloadB64}`;

  // Sign with RSA-SHA256 using Web Crypto
  const privateKey = sa.private_key;
  const pemContents = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, encoder.encode(unsigned));
  const sigB64 = base64url(String.fromCharCode(...new Uint8Array(signature)));

  const jwt = `${unsigned}.${sigB64}`;

  // Exchange JWT for access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const t = await tokenRes.text();
    throw new Error(`Failed to get Google access token: ${t}`);
  }

  const tokenData = (await tokenRes.json()) as { access_token: string };
  return tokenData.access_token;
}

// Build a tar.gz archive of the project files
async function buildTarGz(files: DeployFile[]): Promise<ArrayBuffer> {
  // Build a minimal tar archive manually
  const entries: { header: Uint8Array; content: Uint8Array }[] = [];

  for (const file of files) {
    const path = file.path.replace(/^\/+/, '');
    if (!path || path.endsWith('/')) continue;

    const nameBytes = new TextEncoder().encode(path);
    const contentBytes = file.binary
      ? Uint8Array.from(atob(file.content), (c) => c.charCodeAt(0))
      : new TextEncoder().encode(file.content);
    const size = contentBytes.length;

    // Tar header (512 bytes)
    const header = new Uint8Array(512);
    const view = new DataView(header.buffer);

    // File name (100 bytes)
    header.set(nameBytes.slice(0, 100), 0);

    // File mode (8 bytes, octal string)
    const modeStr = '0000644\0';
    for (let i = 0; i < modeStr.length; i++) header[i + 100] = modeStr.charCodeAt(i);

    // UID (8 bytes)
    const uidStr = '0001000\0';
    for (let i = 0; i < uidStr.length; i++) header[i + 108] = uidStr.charCodeAt(i);

    // GID (8 bytes)
    const gidStr = '0001000\0';
    for (let i = 0; i < gidStr.length; i++) header[i + 116] = gidStr.charCodeAt(i);

    // File size (12 bytes, octal string)
    const sizeStr = size.toString(8).padStart(11, '0') + '\0';
    for (let i = 0; i < sizeStr.length; i++) header[i + 124] = sizeStr.charCodeAt(i);

    // Modification time (12 bytes, octal)
    const mtimeStr = Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0';
    for (let i = 0; i < mtimeStr.length; i++) header[i + 136] = mtimeStr.charCodeAt(i);

    // Type flag: '0' = regular file (byte 156)
    header[156] = 0x30; // '0'

    // USTAR format indicator (bytes 257-262)
    const ustar = 'ustar\0';
    for (let i = 0; i < ustar.length; i++) header[i + 257] = ustar.charCodeAt(i);

    entries.push({ header, content: contentBytes });
  }

  // Concatenate all entries, padded to 512-byte blocks
  const parts: Uint8Array[] = [];
  for (const { header, content } of entries) {
    parts.push(header);
    parts.push(content);
    // Pad content to 512-byte boundary
    const remainder = content.length % 512;
    if (remainder > 0) {
      parts.push(new Uint8Array(512 - remainder));
    }
  }

  // Two 512-byte blocks of zeros to end the archive
  parts.push(new Uint8Array(1024));

  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const tarBuffer = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    tarBuffer.set(part, offset);
    offset += part.length;
  }

  return tarBuffer.buffer;
}

// Compress with gzip using CompressionStream
async function gzipCompress(data: ArrayBuffer): Promise<ArrayBuffer> {
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  writer.write(data);
  writer.close();
  const reader = cs.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { result.set(c, off); off += c.length; }
  return result.buffer;
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

  let body: DeployBody;
  try {
    body = (await request.json()) as DeployBody;
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { projectId, region, serviceAccountKey, serviceName, allowUnauthenticated, files } = body;

  if (!projectId) return json({ error: 'Google Cloud project ID is required' }, { status: 400 });
  if (!region) return json({ error: 'Region is required' }, { status: 400 });
  if (!serviceAccountKey) return json({ error: 'Service account key (JSON) is required' }, { status: 400 });
  if (!Array.isArray(files) || files.length === 0) return json({ error: 'No files to deploy' }, { status: 400 });

  try {
    // Validate service account key format
    let saParsed: Record<string, unknown>;
    try {
      saParsed = JSON.parse(serviceAccountKey);
      if (!saParsed.client_email || !saParsed.private_key) {
        return json({ error: 'Invalid service account key: missing client_email or private_key' }, { status: 400 });
      }
    } catch {
      return json({ error: 'Invalid service account key: not valid JSON' }, { status: 400 });
    }

    // Get access token
    const accessToken = await getAccessToken(serviceAccountKey);

    const slug = serviceName
      ? serviceName.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 63)
      : `omni-builder-${Date.now().toString(36)}`;

    const baseUrl = `https://run.googleapis.com/v2/projects/${projectId}/locations/${region}`;

    // 1. Upload source code to Cloud Storage (using Cloud Build source)
    // We use the Cloud Run "upload source" approach via Google Cloud Storage

    // Upload the tar.gz to Cloud Storage
    const tarData = await buildTarGz(files);
    const gzippedData = await gzipCompress(tarData);

    const storageObjectName = `omni-builder-deployments/${slug}-${Date.now()}.tar.gz`;
    const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${projectId}-cloudbuild/o?uploadType=media&name=${storageObjectName}`;

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
      },
      body: gzippedData,
    });

    if (!uploadRes.ok) {
      // Try the alternative storage bucket naming
      const uploadUrl2 = `https://storage.googleapis.com/upload/storage/v1/b/${projectId}.cloudbuild/o?uploadType=media&name=${storageObjectName}`;
      const uploadRes2 = await fetch(uploadUrl2, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
        },
        body: gzippedData,
      });
      if (!uploadRes2.ok) {
        const t = await uploadRes2.text();
        return json({ error: `Failed to upload source to Cloud Storage: ${t}` }, { status: uploadRes2.status });
      }
    }

    // 2. Create a Cloud Build that builds and deploys to Cloud Run
    const sourceBucket = `${projectId}_cloudbuild`;
    const sourceObject = storageObjectName;

    // Cloud Build config
    const cloudbuildBody = {
      source: {
        storageSource: {
          bucket: sourceBucket,
          object: sourceObject,
        },
      },
      steps: [
        {
          name: 'gcr.io/cloud-builders/npm',
          entrypoint: 'bash',
          args: ['-c', 'if [ -f package.json ]; then npm install; fi'],
        },
        {
          name: 'gcr.io/cloud-builders/npm',
          entrypoint: 'bash',
          args: ['-c', 'if [ -f package.json ]; then npm run build 2>/dev/null || true; fi'],
        },
        {
          name: 'gcr.io/cloud-builders/gcloud',
          args: [
            'run',
            'deploy',
            slug,
            `--source=.`,
            `--region=${region}`,
            '--allow-unauthenticated',
            '--no-cpu-throttling',
            '--memory=512Mi',
            '--cpu=1',
          ],
        },
      ],
      images: [`gcr.io/${projectId}/${slug}`],
      timeout: '1200s',
    };

    if (!allowUnauthenticated) {
      // Remove --allow-unauthenticated flag
      (cloudbuildBody.steps[2] as Record<string, unknown>).args = [
        'run', 'deploy', slug, `--source=.`, `--region=${region}`, '--no-cpu-throttling', '--memory=512Mi', '--cpu=1',
      ];
    }

    const buildRes = await fetch(`https://cloudbuild.googleapis.com/v1/projects/${projectId}/builds`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cloudbuildBody),
    });

    if (!buildRes.ok) {
      const t = await buildRes.text();
      return json({ error: `Failed to create Cloud Build: ${t}` }, { status: buildRes.status });
    }

    const buildData = (await buildRes.json()) as { id: string; name: string };

    // Return the service URL (it takes a few minutes for the build to complete)
    const serviceUrl = `https://${slug}-${projectId}-${region}.a.run.app`;

    return json({
      success: true,
      buildId: buildData.id,
      buildName: buildData.name,
      serviceName: slug,
      url: serviceUrl,
      message: `Cloud Build started. It may take 2-5 minutes for the deployment to complete.`,
      buildLogsUrl: `https://console.cloud.google.com/cloud-build/builds/${buildData.id}?project=${projectId}`,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown deploy error' }, { status: 500 });
  }
}
