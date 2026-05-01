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
  'png','jpg','jpeg','gif','webp','ico','bmp','tiff','svg',
  'mp3','wav','ogg','mp4','webm','mov','avi','mkv',
  'pdf','zip','tar','gz','rar','7z','exe','dll','so','dylib',
  'woff','woff2','ttf','otf','eot',
  'wasm','class','jar','pyc',
]);

function isLikelyBinary(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return BINARY_EXT.has(ext);
}

function parseRepo(input: string): { owner: string; repo: string; ref?: string } | null {
  const cleaned = input.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/, '').replace(/\/$/, '');
  const parts = cleaned.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const [owner, repo, , ...rest] = parts;
  // handle URL like owner/repo/tree/<branch>/...
  let ref: string | undefined;
  if (parts[2] === 'tree' && parts[3]) ref = parts.slice(3).join('/');
  return { owner, repo, ref };
}

async function gh(url: string, token?: string) {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'bolt-import',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  return res;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const repoParam = url.searchParams.get('repo') || '';
  const refParam = url.searchParams.get('ref') || '';
  const token = request.headers.get('x-github-token') || undefined;

  const parsed = parseRepo(repoParam);
  if (!parsed) return json({ error: 'Invalid repo. Use owner/name or a github.com URL.' }, { status: 400 });

  const { owner, repo } = parsed;
  let ref = refParam || parsed.ref || '';

  try {
    if (!ref) {
      const repoRes = await gh(`https://api.github.com/repos/${owner}/${repo}`, token);
      if (!repoRes.ok) {
        return json({ error: `GitHub repo lookup failed: ${repoRes.status} ${await repoRes.text()}` }, { status: repoRes.status });
      }
      const repoInfo = (await repoRes.json()) as { default_branch: string };
      ref = repoInfo.default_branch;
    }

    const treeRes = await gh(`https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`, token);
    if (!treeRes.ok) {
      return json({ error: `Failed to load tree: ${treeRes.status} ${await treeRes.text()}` }, { status: treeRes.status });
    }
    const tree = (await treeRes.json()) as { tree: TreeEntry[]; truncated?: boolean };

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

    const files: ImportedFile[] = [];
    const concurrency = 8;
    let idx = 0;

    async function worker() {
      while (idx < limited.length) {
        const i = idx++;
        const entry = limited[i];
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${entry.path}`;
        try {
          const res = await fetch(rawUrl);
          if (!res.ok) continue;
          const text = await res.text();
          if (text.length > MAX_FILE_BYTES) continue;
          // crude binary detection on content
          if (text.indexOf('\u0000') !== -1) continue;
          files.push({ path: entry.path, content: text });
        } catch {
          /* ignore */
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, worker));
    files.sort((a, b) => a.path.localeCompare(b.path));

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
    return json({ error: e instanceof Error ? e.message : 'Failed to import' }, { status: 500 });
  }
}
