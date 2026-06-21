import { actualSyncUrl } from '../web/urlPolicy';
import type { ActualBudgetConfig } from '../types';
import {
  deriveActualEncryptionKey,
  validateActualEncryptionKey,
  type ActualKeyTestPayload,
} from './actualEncryption';

type ListUserFilesResponse = {
  data?: ActualRemoteBudget[];
  reason?: string;
  status?: string;
};

type ActualRemoteBudget = {
  deleted?: boolean | number;
  encryptKeyId?: string | null;
  fileId?: string;
  groupId?: string | null;
  name?: string;
};

type UserKeyResponse = {
  data?: {
    id?: string;
    salt?: string;
    test?: string | null;
  };
  reason?: string;
  status?: string;
};

export async function loadSingleActualBudgetConfig({
  encryptionPassword,
  serverUrl,
  token,
}: {
  encryptionPassword: string | null;
  serverUrl: string;
  token: string;
}): Promise<ActualBudgetConfig> {
  const filesUrl = actualSyncUrl(serverUrl, '/list-user-files');
  const payload = await requestActualJson<ListUserFilesResponse>(filesUrl, {
    headers: actualTokenHeaders(token),
    method: 'GET',
  });

  if (!Array.isArray(payload.data)) {
    throw new Error('Actual server did not return budget files.');
  }

  const usableBudgets = payload.data.filter(isUsableBudget);
  if (usableBudgets.length === 0) {
    throw new Error('Actual server did not return a usable synced budget.');
  }
  if (usableBudgets.length > 1) {
    throw new Error('Actual server returned multiple synced budgets; budget picker is not implemented yet.');
  }

  const budget = usableBudgets[0];
  const encryptKeyId = budget.encryptKeyId ?? null;
  let encryptSalt: string | null = null;

  if (encryptKeyId) {
    if (!encryptionPassword) {
      throw new Error('This Actual budget is encrypted; enter the encryption password.');
    }

    const keyInfo = await loadActualBudgetKey({
      fileId: budget.fileId,
      serverUrl,
      token,
    });
    if (keyInfo.id !== encryptKeyId) {
      throw new Error('Actual server returned encryption metadata for a different key.');
    }
    if (!keyInfo.salt || !keyInfo.test) {
      throw new Error('Actual server did not return usable encryption metadata.');
    }

    encryptSalt = keyInfo.salt;
    validateActualEncryptionKey({
      key: deriveActualEncryptionKey({
        id: encryptKeyId,
        password: encryptionPassword,
        salt: keyInfo.salt,
      }),
      test: JSON.parse(keyInfo.test) as ActualKeyTestPayload,
    });
  }

  return {
    encryptKeyId,
    encryptSalt,
    fileId: budget.fileId,
    groupId: budget.groupId,
    name: budget.name || budget.fileId,
  };
}

async function loadActualBudgetKey({
  fileId,
  serverUrl,
  token,
}: {
  fileId: string;
  serverUrl: string;
  token: string;
}): Promise<{ id: string; salt: string | null; test: string | null }> {
  const keyUrl = actualSyncUrl(serverUrl, '/user-get-key');
  const payload = await requestActualJson<UserKeyResponse>(keyUrl, {
    body: JSON.stringify({ fileId }),
    headers: {
      ...actualTokenHeaders(token),
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const id = payload.data?.id;
  if (!id) {
    throw new Error('Actual server did not return an encryption key id.');
  }

  return {
    id,
    salt: payload.data?.salt ?? null,
    test: payload.data?.test ?? null,
  };
}

function isUsableBudget(
  budget: ActualRemoteBudget,
): budget is ActualRemoteBudget & { fileId: string; groupId: string } {
  return (
    budget.deleted !== true &&
    budget.deleted !== 1 &&
    typeof budget.fileId === 'string' &&
    budget.fileId.length > 0 &&
    typeof budget.groupId === 'string' &&
    budget.groupId.length > 0
  );
}

function actualTokenHeaders(token: string): Record<string, string> {
  return {
    'X-ACTUAL-TOKEN': token,
  };
}

async function requestActualJson<T>(
  url: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.text();
  let payload: unknown;

  try {
    payload = JSON.parse(body);
  } catch {
    const preview = body.replace(/\s+/g, ' ').slice(0, 120);
    throw new Error(
      `Actual server returned a non-JSON response for ${url} (${response.status} ${response.statusText || 'unknown status'}): ${preview || 'empty response'}`,
    );
  }

  if (!response.ok) {
    const reason =
      payload &&
      typeof payload === 'object' &&
      'reason' in payload &&
      typeof payload.reason === 'string'
        ? payload.reason
        : response.statusText;
    throw new Error(reason || 'Actual server rejected the request.');
  }

  return payload as T;
}

