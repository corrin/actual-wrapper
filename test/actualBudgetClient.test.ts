import { gcm } from '@noble/ciphers/aes.js';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { loadSingleActualBudgetConfig } from '../src/sync/actualBudgetClient';
import { deriveActualEncryptionKey } from '../src/sync/actualEncryption';

function jsonResponse(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
    ...init,
  });
}

describe('Actual budget metadata client', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('loads the single usable unencrypted budget', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            deleted: 0,
            encryptKeyId: null,
            fileId: 'file-id',
            groupId: 'group-id',
            name: 'Budget',
          },
        ],
        status: 'ok',
      }),
    );

    await expect(
      loadSingleActualBudgetConfig({
        encryptionPassword: null,
        serverUrl: 'https://budget.example.com/',
        token: 'token',
      }),
    ).resolves.toEqual({
      encryptKeyId: null,
      encryptSalt: null,
      fileId: 'file-id',
      groupId: 'group-id',
      name: 'Budget',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://budget.example.com/sync/list-user-files',
      {
        headers: { 'X-ACTUAL-TOKEN': 'token' },
        method: 'GET',
      },
    );
  });

  it('fails visibly when multiple synced budgets are available', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [
          { deleted: 0, fileId: 'file-1', groupId: 'group-1' },
          { deleted: 0, fileId: 'file-2', groupId: 'group-2' },
        ],
        status: 'ok',
      }),
    );

    await expect(
      loadSingleActualBudgetConfig({
        encryptionPassword: null,
        serverUrl: 'https://budget.example.com/',
        token: 'token',
      }),
    ).rejects.toThrow(
      'Actual server returned multiple synced budgets; budget picker is not implemented yet.',
    );
  });

  it('requires an encryption password for encrypted budgets', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            deleted: 0,
            encryptKeyId: 'key-id',
            fileId: 'file-id',
            groupId: 'group-id',
            name: 'Budget',
          },
        ],
        status: 'ok',
      }),
    );

    await expect(
      loadSingleActualBudgetConfig({
        encryptionPassword: null,
        serverUrl: 'https://budget.example.com/',
        token: 'token',
      }),
    ).rejects.toThrow(
      'This Actual budget is encrypted; enter the encryption password.',
    );
  });

  it('validates and stores encryption metadata for encrypted budgets', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              deleted: 0,
              encryptKeyId: 'key-id',
              fileId: 'file-id',
              groupId: 'group-id',
              name: 'Budget',
            },
          ],
          status: 'ok',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: 'key-id',
            salt: 'salt-value',
            test: JSON.stringify(encryptionTestPayload()),
          },
          status: 'ok',
        }),
      );

    await expect(
      loadSingleActualBudgetConfig({
        encryptionPassword: 'secret',
        serverUrl: 'https://budget.example.com/',
        token: 'token',
      }),
    ).resolves.toEqual({
      encryptKeyId: 'key-id',
      encryptSalt: 'salt-value',
      fileId: 'file-id',
      groupId: 'group-id',
      name: 'Budget',
    });
  });
});

function encryptionTestPayload() {
  const key = deriveActualEncryptionKey({
    id: 'key-id',
    password: 'secret',
    salt: 'salt-value',
  });
  const iv = new Uint8Array(12).fill(3);
  const encryptedWithTag = gcm(key.key, iv).encrypt(new Uint8Array([1, 2, 3]));
  return {
    meta: {
      algorithm: 'aes-256-gcm',
      authTag: bytesToBase64(encryptedWithTag.slice(-16)),
      iv: bytesToBase64(iv),
      keyId: 'key-id',
    },
    value: bytesToBase64(encryptedWithTag.slice(0, -16)),
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

