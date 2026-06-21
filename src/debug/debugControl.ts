export type DebugCommand = {
  id: string;
  payload?: Record<string, unknown>;
  type: string;
};

export type DebugClientMessage = {
  id?: string;
  payload?: Record<string, unknown>;
  timestamp: string;
  type: string;
};

export function normalizeDebugServerUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return '';
  }

  const parsed = new URL(trimmed);
  if (parsed.protocol !== 'ws:') {
    throw new Error('Debug server URL must use ws://.');
  }

  if (!isLocalLanHost(parsed.hostname)) {
    throw new Error('Debug server URL must point to localhost or a private LAN IP.');
  }

  parsed.hash = '';
  parsed.search = '';
  parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  return parsed.toString();
}

export function isLocalLanHost(host: string): boolean {
  const normalized = host.toLowerCase();
  if (normalized === 'localhost') {
    return true;
  }

  if (
    normalized.startsWith('10.') ||
    normalized.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized) ||
    normalized.startsWith('127.')
  ) {
    return true;
  }

  return false;
}

export function parseDebugCommand(raw: string): DebugCommand | null {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const candidate = parsed as Partial<DebugCommand>;
  if (typeof candidate.id !== 'string' || typeof candidate.type !== 'string') {
    return null;
  }

  return {
    id: candidate.id,
    payload:
      candidate.payload && typeof candidate.payload === 'object'
        ? (candidate.payload as Record<string, unknown>)
        : undefined,
    type: candidate.type,
  };
}
