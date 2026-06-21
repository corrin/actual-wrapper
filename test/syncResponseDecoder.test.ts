import protobuf from 'protobufjs';
import { describe, expect, it } from 'vitest';
import { gcm } from '@noble/ciphers/aes.js';

import {
  decodeSyncResponse,
  decodeUnencryptedSyncResponse,
  encodeSyncRequest,
} from '../src/sync/syncResponseDecoder';
import { deriveActualEncryptionKey } from '../src/sync/actualEncryption';
import type { ActualBudgetConfig } from '../src/types';

const SYNC_PROTO = `
syntax = "proto3";
message EncryptedData {
  bytes iv = 1;
  bytes authTag = 2;
  bytes data = 3;
}
message Message {
  string dataset = 1;
  string row = 2;
  string column = 3;
  string value = 4;
}
message MessageEnvelope {
  string timestamp = 1;
  bool isEncrypted = 2;
  bytes content = 3;
}
message SyncResponse {
  repeated MessageEnvelope messages = 1;
  string merkle = 2;
}
message SyncRequest {
  reserved 4;
  repeated MessageEnvelope messages = 1;
  string fileId = 2;
  string groupId = 3;
  string keyId = 5;
  string since = 6;
}
`;

const root = protobuf.parse(SYNC_PROTO).root;
const EncryptedData = root.lookupType('EncryptedData');
const Message = root.lookupType('Message');
const SyncResponse = root.lookupType('SyncResponse');
const SyncRequest = root.lookupType('SyncRequest');

const encryptedBudget: ActualBudgetConfig = {
  encryptKeyId: 'key-id',
  encryptSalt: 'salt-value',
  fileId: 'file-id',
  groupId: 'group-id',
  name: 'Budget',
};

function syncResponse(messages: unknown[]): Uint8Array {
  return SyncResponse.encode(SyncResponse.create({ messages })).finish();
}

function messageContent(value: {
  column: string;
  dataset: string;
  row: string;
  value: string;
}): Uint8Array {
  return Message.encode(Message.create(value)).finish();
}

describe('decodeUnencryptedSyncResponse', () => {
  it('encodes Actual sync requests with budget metadata and no outgoing messages', () => {
    const encoded = encodeSyncRequest({
      budget: encryptedBudget,
      since: '2026-06-21T00:00:00.000Z-0000-0000000000000000',
    });

    const decoded = SyncRequest.decode(encoded) as unknown as {
      fileId: string;
      groupId: string;
      keyId: string;
      messages: unknown[];
      since: string;
    };

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
  return EncryptedData.encode(
    EncryptedData.create({
      authTag,
      data,
      iv,
    }),
  ).finish();
}
