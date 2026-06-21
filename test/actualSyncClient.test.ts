import protobuf from 'protobufjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createActualSyncClient } from '../src/sync/actualSyncClient';

const SYNC_PROTO = `
syntax = "proto3";
message SyncResponse {
  repeated MessageEnvelope messages = 1;
  string merkle = 2;
}
message MessageEnvelope {
  string timestamp = 1;
  bool isEncrypted = 2;
  bytes content = 3;
}
`;

const root = protobuf.parse(SYNC_PROTO).root;
const SyncResponse = root.lookupType('SyncResponse');

describe('Actual sync client', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-21T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('posts a sync request to Actual using the stored token and first-run timestamp', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        SyncResponse.encode(SyncResponse.create({ messages: [] })).finish() as unknown as BodyInit,
        {
          headers: { 'Content-Type': 'application/actual-sync' },
          status: 200,
        },
      ),
    );

    const client = createActualSyncClient({
      budget: {
        encryptKeyId: null,
        encryptSalt: null,
        fileId: 'file-id',
        groupId: 'group-id',
        name: 'Budget',
      },
      encryptionPassword: null,
      serverUrl: 'https://budget.example.com/',
      token: 'token',
    });

    await expect(client.fetchMessagesSince(null)).resolves.toEqual({
      messages: [],
      nextSyncTimestamp: '2026-06-21T00:00:00.000Z-0000-0000000000000000',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://budget.example.com/sync/sync',
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/actual-sync',
          'X-ACTUAL-TOKEN': 'token',
        },
        method: 'POST',
      }),
    );
  });
});
