import { actualAccountUrl } from '../web/urlPolicy';

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

async function readActualJson<T>(
  response: Response,
  context: string,
): Promise<T> {
  const body = await response.text();
  let payload: unknown = null;

  try {
    payload = JSON.parse(body);
  } catch {
    const contentType = response.headers.get('content-type') || 'unknown';
    const preview = body.replace(/\s+/g, ' ').slice(0, 120);
    throw new Error(
      `Actual server returned a non-JSON response for ${context} (${response.status} ${response.statusText || 'unknown status'}, ${contentType}): ${preview || 'empty response'}`,
    );
  }

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
  const response = await fetch(loginMethodsUrl);
  const payload = await readActualJson<LoginMethodsResponse>(
    response,
    loginMethodsUrl,
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
  const response = await fetch(loginUrl, {
    body: JSON.stringify({
      loginMethod: 'password',
      password,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  const payload = await readActualJson<LoginResponse>(response, loginUrl);

  if (payload.status === 'error') {
    throw new Error(payload.reason || 'Actual login failed.');
  }

  const token = payload.data?.token;
  if (!token) {
    throw new Error('Actual login did not return a token.');
  }

  return token;
}
