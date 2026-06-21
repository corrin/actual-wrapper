import { actualAccountUrl } from '../web/urlPolicy';
import { appendDiagnosticEvent } from '../storage/diagnostics';

export type ActualLoginMethod = {
  active?: boolean;
  displayName?: string;
  method: string;
};

type LoginMethodsResponse = {
  methods?: ActualLoginMethod[];
  status?: string;
};

type LoginResponse = {
  data?: {
    token?: string;
  };
  reason?: string;
  status?: string;
};

async function requestActualJson<T>(
  url: string,
  phase: string,
  init?: RequestInit,
): Promise<T> {
  const startedAt = Date.now();
  let response: Response;

  await appendDiagnosticEvent({
    area: 'actual-auth',
    data: {
      method: init?.method ?? 'GET',
      phase,
      url,
    },
    level: 'info',
    message: 'request started',
  });

  try {
    response = init ? await fetch(url, init) : await fetch(url);
  } catch (error) {
    await appendDiagnosticEvent({
      area: 'actual-auth',
      data: {
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
        phase,
        url,
      },
      level: 'error',
      message: 'request failed',
    });
    throw error;
  }

  const body = await response.text();
  const contentType = response.headers.get('content-type') || 'unknown';
  const durationMs = Date.now() - startedAt;
  let payload: unknown = null;

  try {
    payload = JSON.parse(body);
  } catch {
    const preview = body.replace(/\s+/g, ' ').slice(0, 120);
    await appendDiagnosticEvent({
      area: 'actual-auth',
      data: {
        bodyPreview: preview || 'empty response',
        contentType,
        durationMs,
        phase,
        status: response.status,
        statusText: response.statusText || 'unknown status',
        url,
      },
      level: 'error',
      message: 'non-json response',
    });
    throw new Error(
      `Actual server returned a non-JSON response for ${url} (${response.status} ${response.statusText || 'unknown status'}, ${contentType}): ${preview || 'empty response'}`,
    );
  }

  await appendDiagnosticEvent({
    area: 'actual-auth',
    data: {
      contentType,
      durationMs,
      ok: response.ok,
      phase,
      status: response.status,
      statusText: response.statusText || 'unknown status',
      url,
    },
    level: response.ok ? 'info' : 'warn',
    message: 'response received',
  });

  if (!response.ok) {
    const reason =
      typeof payload === 'object' &&
      payload !== null &&
      'reason' in payload &&
      typeof payload.reason === 'string'
        ? payload.reason
        : response.statusText;
    throw new Error(reason || 'Actual server rejected the request.');
  }

  return payload as T;
}

export async function getActualLoginMethods(
  serverUrl: string,
): Promise<ActualLoginMethod[]> {
  const loginMethodsUrl = actualAccountUrl(serverUrl, '/login-methods');
  const payload = await requestActualJson<LoginMethodsResponse>(
    loginMethodsUrl,
    'login-methods',
  );

  if (!Array.isArray(payload.methods)) {
    throw new Error('Actual server did not return login methods.');
  }

  return payload.methods;
}

export async function loginToActualWithPassword({
  password,
  serverUrl,
}: {
  password: string;
  serverUrl: string;
}): Promise<string> {
  if (!password) {
    throw new Error('Enter your Actual server password.');
  }

  const loginMethods = await getActualLoginMethods(serverUrl);
  if (!loginMethods.some(method => method.method === 'password')) {
    throw new Error('This Actual server does not offer password login.');
  }

  const loginUrl = actualAccountUrl(serverUrl, '/login');
  const payload = await requestActualJson<LoginResponse>(loginUrl, 'login', {
    body: JSON.stringify({
      loginMethod: 'password',
      password,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (payload.status === 'error') {
    throw new Error(payload.reason || 'Actual login failed.');
  }

  const token = payload.data?.token;
  if (!token) {
    throw new Error('Actual login did not return a token.');
  }

  return token;
}
