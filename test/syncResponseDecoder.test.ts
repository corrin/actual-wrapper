import protobuf from 'protobufjs';
import { describe, expect, it } from 'vitest';

import { decodeUnencryptedSyncResponse } from '../src/sync/syncResponseDecoder';

const SYNC_PROTO = `
syntax = "proto3";
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
  bytes merkle = 2;
}
`;

const root = protobuf.parse(SYNC_PROTO).root;
const Message = root.lookupType('Message');
const SyncResponse = root.lookupType('SyncResponse');

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
