export function normalizeServerUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Enter the HTTPS URL for your Actual server.');
  }

  const parsed = new URL(trimmed);
  if (parsed.protocol !== 'https:') {
    throw new Error('Version 1 only supports HTTPS Actual server URLs.');
  }

  parsed.hash = '';
  parsed.search = '';
  parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  return parsed.toString();
}

export function actualAccountUrl(serverUrl: string, path: string): string {
  return joinActualUrl(serverUrl, '/account', path);
}

export function actualSyncUrl(serverUrl: string, path: string): string {
  return joinActualUrl(serverUrl, '/sync', path);
}

export function sameOrigin(serverUrl: string, candidateUrl: string): boolean {
  try {
    return new URL(serverUrl).origin === new URL(candidateUrl).origin;
  } catch {
    return false;
  }
}

function joinActualUrl(serverUrl: string, prefix: string, path: string): string {
  const parsed = new URL(serverUrl);
  const basePath = parsed.pathname.replace(/\/+$/, '');
  const nextPath = path.startsWith('/') ? path : `/${path}`;
  parsed.pathname = `${basePath}${prefix}${nextPath}`.replace(/\/{2,}/g, '/');
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}
