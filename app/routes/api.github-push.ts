import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';

interface PushFile {
  path: string;
  content: string;
}

interface PushBody {
  token: string;
  repo: string;
  branch?: string;
  message?: string;
  files: PushFile[];
  createIfMissing?: boolean;
  private?: boolean;
}

const API = 'https://api.github.com';

function parseRepo(input: string): { owner: string; name: string } | null {
  const cleaned = input.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
  const parts = cleaned.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  return { owner: parts[0], name: parts[1] };
}

async function gh(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'bolt-replit',
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  return res;
}

function utf8ToBase64(str: string): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(str, 'utf-8').toString('base64');
  // eslint-disable-next-line no-undef
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  // eslint-disable-next-line no-undef
  return btoa(bin);
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

  let body: PushBody;
  try {
    body = (await request.json()) as PushBody;
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { token, repo, branch = 'main', message = 'Sync from Bolt', files, createIfMissing = true, private: isPrivate = true } = body;
  if (!token) return json({ error: 'GitHub token is required' }, { status: 400 });
  if (!repo) return json({ error: 'Repository (owner/name) is required' }, { status: 400 });
  if (!Array.isArray(files) || files.length === 0) return json({ error: 'No files to push' }, { status: 400 });

  const parsed = parseRepo(repo);
  if (!parsed) return json({ error: 'Invalid repository format. Use owner/name.' }, { status: 400 });
  const { owner, name } = parsed;

  // 1. Check repo exists. If not and createIfMissing, create on user account.
  let repoRes = await gh(token, `/repos/${owner}/${name}`);
  if (repoRes.status === 404) {
    if (!createIfMissing) return json({ error: 'Repository not found.' }, { status: 404 });
    // figure out auth user
    const meRes = await gh(token, '/user');
    if (!meRes.ok) {
      const t = await meRes.text();
      return json({ error: `Could not authenticate token: ${t}` }, { status: 401 });
    }
    const me = (await meRes.json()) as { login: string };
    if (me.login.toLowerCase() === owner.toLowerCase()) {
      const createRes = await gh(token, '/user/repos', {
        method: 'POST',
        body: JSON.stringify({ name, private: isPrivate, auto_init: true }),
      });
      if (!createRes.ok) {
        const t = await createRes.text();
        return json({ error: `Failed to create user repo: ${t}` }, { status: createRes.status });
      }
    } else {
      const createRes = await gh(token, `/orgs/${owner}/repos`, {
        method: 'POST',
        body: JSON.stringify({ name, private: isPrivate, auto_init: true }),
      });
      if (!createRes.ok) {
        const t = await createRes.text();
        return json({ error: `Repo not found and could not create under '${owner}': ${t}` }, { status: createRes.status });
      }
    }
    // re-fetch repo info
    repoRes = await gh(token, `/repos/${owner}/${name}`);
  }
  if (!repoRes.ok) {
    const t = await repoRes.text();
    return json({ error: `Repo error: ${t}` }, { status: repoRes.status });
  }
  const repoInfo = (await repoRes.json()) as { default_branch: string };
  const targetBranch = branch || repoInfo.default_branch || 'main';

  // 2. Get ref for branch (or fall back to default branch's HEAD)
  let baseSha: string | null = null;
  let baseTreeSha: string | null = null;
  let branchExists = false;

  const refRes = await gh(token, `/repos/${owner}/${name}/git/ref/heads/${targetBranch}`);
  if (refRes.ok) {
    const refData = (await refRes.json()) as { object: { sha: string } };
    baseSha = refData.object.sha;
    branchExists = true;
  } else {
    // try default branch
    const defRes = await gh(token, `/repos/${owner}/${name}/git/ref/heads/${repoInfo.default_branch}`);
    if (defRes.ok) {
      const defData = (await defRes.json()) as { object: { sha: string } };
      baseSha = defData.object.sha;
    }
  }

  if (baseSha) {
    const commitRes = await gh(token, `/repos/${owner}/${name}/git/commits/${baseSha}`);
    if (commitRes.ok) {
      const commitData = (await commitRes.json()) as { tree: { sha: string } };
      baseTreeSha = commitData.tree.sha;
    }
  }

  // 3. Create blobs for each file
  const treeItems: Array<{ path: string; mode: '100644'; type: 'blob'; sha: string }> = [];
  for (const f of files) {
    const blobRes = await gh(token, `/repos/${owner}/${name}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: utf8ToBase64(f.content), encoding: 'base64' }),
    });
    if (!blobRes.ok) {
      const t = await blobRes.text();
      return json({ error: `Blob creation failed for ${f.path}: ${t}` }, { status: blobRes.status });
    }
    const blob = (await blobRes.json()) as { sha: string };
    treeItems.push({ path: f.path.replace(/^\/+/, ''), mode: '100644', type: 'blob', sha: blob.sha });
  }

  // 4. Create tree
  const treeBody: Record<string, unknown> = { tree: treeItems };
  if (baseTreeSha) treeBody.base_tree = baseTreeSha;
  const treeRes = await gh(token, `/repos/${owner}/${name}/git/trees`, {
    method: 'POST',
    body: JSON.stringify(treeBody),
  });
  if (!treeRes.ok) {
    const t = await treeRes.text();
    return json({ error: `Tree creation failed: ${t}` }, { status: treeRes.status });
  }
  const tree = (await treeRes.json()) as { sha: string };

  // 5. Create commit
  const commitBody: Record<string, unknown> = { message, tree: tree.sha };
  if (baseSha) commitBody.parents = [baseSha];
  const commitRes = await gh(token, `/repos/${owner}/${name}/git/commits`, {
    method: 'POST',
    body: JSON.stringify(commitBody),
  });
  if (!commitRes.ok) {
    const t = await commitRes.text();
    return json({ error: `Commit failed: ${t}` }, { status: commitRes.status });
  }
  const commit = (await commitRes.json()) as { sha: string };

  // 6. Update or create branch ref
  if (branchExists) {
    const updateRes = await gh(token, `/repos/${owner}/${name}/git/refs/heads/${targetBranch}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });
    if (!updateRes.ok) {
      const t = await updateRes.text();
      return json({ error: `Failed to update branch: ${t}` }, { status: updateRes.status });
    }
  } else {
    const createRefRes = await gh(token, `/repos/${owner}/${name}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${targetBranch}`, sha: commit.sha }),
    });
    if (!createRefRes.ok) {
      const t = await createRefRes.text();
      return json({ error: `Failed to create branch: ${t}` }, { status: createRefRes.status });
    }
  }

  return json({
    success: true,
    owner,
    repo: name,
    branch: targetBranch,
    commit: commit.sha,
    pushed: files.length,
    url: `https://github.com/${owner}/${name}/tree/${targetBranch}`,
  });
}
