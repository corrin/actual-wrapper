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

export function sameOrigin(serverUrl: string, candidateUrl: string): boolean {
  try {
    return new URL(serverUrl).origin === new URL(candidateUrl).origin;
  } catch {
    return false;
  }
}
