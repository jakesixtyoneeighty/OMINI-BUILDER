function normalizePath(path: string) {
  return path.replace(/\\/g, '/');
}

function trimTrailingSlashes(path: string) {
  return path.length > 1 ? path.replace(/\/+$/g, '') : path;
}

export function dirname(path: string) {
  const normalized = trimTrailingSlashes(normalizePath(path));

  if (!normalized || normalized === '.') {
    return '.';
  }

  if (normalized === '/') {
    return '/';
  }

  const index = normalized.lastIndexOf('/');

  if (index === -1) {
    return '.';
  }

  if (index === 0) {
    return '/';
  }

  return normalized.slice(0, index);
}

export function relativePath(from: string, to: string) {
  const normalizedFrom = trimTrailingSlashes(normalizePath(from));
  const normalizedTo = normalizePath(to);

  if (normalizedTo === normalizedFrom) {
    return '';
  }

  if (normalizedTo.startsWith(`${normalizedFrom}/`)) {
    return normalizedTo.slice(normalizedFrom.length + 1);
  }

  return normalizedTo.replace(/^\/+/g, '');
}

export function joinPaths(...parts: string[]) {
  const joined = parts
    .filter(Boolean)
    .join('/')
    .replace(/\/+/g, '/');

  return joined === '/' ? joined : trimTrailingSlashes(joined);
}
