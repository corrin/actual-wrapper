import {
  create,
  EncryptedDataSchema,
  fromBinary,
  MessageSchema,
  SyncRequestSchema,
  SyncResponseSchema,
  toBinary,
} from '@actual-app/crdt';
import { describe, expect, it } from 'vitest';
import { gcm } from '@noble/ciphers/aes.js';

import {
  decodeSyncResponse,
  decodeUnencryptedSyncResponse,
  encodeSyncRequest,
} from '../src/sync/syncResponseDecoder';
import { deriveActualEncryptionKey } from '../src/sync/actualEncryption';
import type { ActualBudgetConfig } from '../src/types';

const encryptedBudget: ActualBudgetConfig = {
  encryptKeyId: 'key-id',
  encryptSalt: 'salt-value',
  fileId: 'file-id',
  groupId: 'group-id',
  name: 'Budget',
};

function syncResponse(
  messages: Array<{
    content: Uint8Array;
    isEncrypted: boolean;
    timestamp: string;
  }>,
): Uint8Array {
  return toBinary(
    SyncResponseSchema,
    create(SyncResponseSchema, { messages }),
  );
}

function messageContent(value: {
  column: string;
  dataset: string;
  row: string;
  value: string;
}): Uint8Array {
  return toBinary(MessageSchema, create(MessageSchema, value));
}

describe('decodeUnencryptedSyncResponse', () => {
  it('encodes Actual sync requests with budget metadata and no outgoing messages', () => {
    const encoded = encodeSyncRequest({
      budget: encryptedBudget,
      since: '2026-06-21T00:00:00.000Z-0000-0000000000000000',
    });

    const decoded = fromBinary(SyncRequestSchema, encoded);

    expect(decoded).toMatchObject({
      fileId: 'file-id',
      groupId: 'group-id',
      keyId: 'key-id',
      messages: [],
      since: '2026-06-21T00:00:00.000Z-0000-0000000000000000',
    });
  });

  it('decodes unencrypted Actual sync messages', () => {
    const decoded = decodeUnencryptedSyncResponse(
      syncResponse([
        {
          content: messageContent({
            column: 'amount',
            dataset: 'transactions',
            row: 'tx-1',
            value: 'N:1234',
          }),
          isEncrypted: false,
          timestamp: '100',
        },
      ]),
    );

    expect(decoded.messages).toEqual([
      {
        column: 'amount',
        dataset: 'transactions',
        row: 'tx-1',
        timestamp: '100',
        value: 1234,
      },
    ]);
  });

  it('decodes encrypted Actual sync messages with the budget encryption password', () => {
    const content = encryptedMessageContent({
      column: 'amount',
      dataset: 'transactions',
      row: 'tx-1',
      value: 'N:1234',
    });

    const decoded = decodeSyncResponse({
      budget: encryptedBudget,
      encryptionPassword: 'secret',
      payload: syncResponse([
        {
          content,
          isEncrypted: true,
          timestamp: '100',
        },
      ]),
    });

    expect(decoded.messages).toEqual([
      {
        column: 'amount',
        dataset: 'transactions',
        row: 'tx-1',
        timestamp: '100',
        value: 1234,
      },
    ]);
  });

  it('fails on encrypted messages instead of counting or skipping them', () => {
    expect(() =>
      decodeUnencryptedSyncResponse(
        syncResponse([
          {
            content: new Uint8Array([1, 2, 3]),
            isEncrypted: true,
            timestamp: '100',
          },
        ]),
      ),
    ).toThrow(
      'Actual sync response contains encrypted messages; decrypt before counting transactions.',
    );
  });
});

function encryptedMessageContent(value: {
  column: string;
  dataset: string;
  row: string;
  value: string;
}): Uint8Array {
  const key = deriveActualEncryptionKey({
    id: 'key-id',
    password: 'secret',
    salt: 'salt-value',
  });
  const iv = new Uint8Array(12).fill(7);
  const encryptedWithTag = gcm(key.key, iv).encrypt(messageContent(value));
  const data = encryptedWithTag.slice(0, -16);
  const authTag = encryptedWithTag.slice(-16);
  return toBinary(
    EncryptedDataSchema,
    create(EncryptedDataSchema, {
      authTag,
      data,
      iv,
    }),
  );
}
