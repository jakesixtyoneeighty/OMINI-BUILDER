import { type LoaderFunctionArgs, json } from '@remix-run/cloudflare';

interface TreeEntry {
  path: string;
  type: 'blob' | 'tree' | 'commit';
  size?: number;
  sha: string;
}

interface ImportedFile {
  path: string;
  content: string;
}

const MAX_FILE_BYTES = 200 * 1024;
const MAX_TOTAL_FILES = 250;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.cache', '.turbo', 'coverage', '.pnpm-store']);
const BINARY_EXT = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'tiff',
  'mp3', 'wav', 'ogg', 'mp4', 'webm', 'mov', 'avi', 'mkv',
  'pdf', 'zip', 'tar', 'gz', 'rar', '7z', 'exe', 'dll', 'so', 'dylib',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  'wasm', 'class', 'jar', 'pyc',
]);

function isLikelyBinary(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return BINARY_EXT.has(ext);
}

function parseRepo(input: string): { owner: string; repo: string; ref?: string } | null {
  const cleaned = input.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/, '').replace(/\/$/, '');
  const parts = cleaned.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0];
  const repo = parts[1];
  let ref: string | undefined;
  if (parts[2] === 'tree' && parts[3]) {
    ref = parts.slice(3).join('/');
  }
  return { owner, repo, ref };
}

async function gh(url: string, token?: string) {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Mojo-Builder',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { headers });
}

/**
 * Fetch a single file's content using GitHub Blob API (base64 encoded).
 * This uses api.github.com domain which works on Cloudflare Workers,
 * unlike raw.githubusercontent.com which is often blocked.
 */
async function fetchBlobContent(
  owner: string,
  repo: string,
  sha: string,
  token?: string,
): Promise<string | null> {
  try {
    const res = await gh(`https://api.github.com/repos/${owner}/${repo}/git/blobs/${sha}`, token);
    if (!res.ok) return null;

    const data = (await res.json()) as { content?: string; encoding?: string; size?: number };

    if (data.encoding === 'base64' && data.content) {
      // Decode base64 to string
      const binary = atob(data.content.replace(/\n/g, ''));
      // Check for null bytes (binary content)
      if (binary.indexOf('\x00') !== -1) return null;
      return binary;
    }

    return null;
  } catch {
    return null;
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const repoParam = url.searchParams.get('repo') || '';
  const token = request.headers.get('x-github-token') || undefined;

  const parsed = parseRepo(repoParam);
  if (!parsed) {
    return json({ error: 'Invalid repository. Use owner/name or a github.com URL.' }, { status: 400 });
  }

  const { owner, repo } = parsed;
  let ref = parsed.ref || '';

  try {
    // Step 1: Get default branch if no ref specified
    if (!ref) {
      const repoRes = await gh(`https://api.github.com/repos/${owner}/${repo}`, token);
      if (!repoRes.ok) {
        const errText = await repoRes.text();
        if (repoRes.status === 404) {
          return json({ error: `Repository '${owner}/${repo}' not found. Check the name and that it is public.` }, { status: 404 });
        }
        if (repoRes.status === 403) {
          return json({ error: 'Rate limit do GitHub atingido. Tente novamente em alguns minutos ou adicione um token.' }, { status: 403 });
        }
        return json({ error: `GitHub API error: ${repoRes.status} ${errText}` }, { status: repoRes.status });
      }
      const repoInfo = (await repoRes.json()) as { default_branch: string };
      ref = repoInfo.default_branch;
    }

    // Step 2: Get the full file tree
    const treeRes = await gh(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
      token,
    );
    if (!treeRes.ok) {
      return json({ error: `Failed to load tree: ${treeRes.status} ${await treeRes.text()}` }, { status: treeRes.status });
    }
    const tree = (await treeRes.json()) as { tree: TreeEntry[]; truncated?: boolean };

    // Step 3: Filter eligible files (not binary, not in skip dirs, under size limit)
    const blobs = tree.tree.filter((e) => e.type === 'blob');
    const eligible = blobs.filter((e) => {
      if ((e.size ?? 0) > MAX_FILE_BYTES) return false;
      if (isLikelyBinary(e.path)) return false;
      const segments = e.path.split('/');
      if (segments.some((s) => SKIP_DIRS.has(s))) return false;
      return true;
    });

    const limited = eligible.slice(0, MAX_TOTAL_FILES);
    const skipped = blobs.length - limited.length;

    // Step 4: Fetch file contents using GitHub Blob API (base64)
    // This is more reliable on Cloudflare Workers than raw.githubusercontent.com
    const files: ImportedFile[] = [];
    const concurrency = 6;
    let idx = 0;

    async function worker() {
      while (idx < limited.length) {
        const i = idx++;
        const entry = limited[i];
        const content = await fetchBlobContent(owner, repo, entry.sha, token);
        if (content !== null && content.length <= MAX_FILE_BYTES) {
          files.push({ path: entry.path, content });
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, worker));
    files.sort((a, b) => a.path.localeCompare(b.path));

    if (files.length === 0 && limited.length > 0) {
      return json({ error: 'Could not fetch any file contents. The repository might be empty or the files are all binary.' }, { status: 422 });
    }

    return json({
      owner,
      repo,
      ref,
      files,
      stats: {
        totalBlobs: blobs.length,
        imported: files.length,
        skipped,
        truncated: tree.truncated ?? false,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Import failed';
    return json({ error: msg }, { status: 500 });
  }
}
