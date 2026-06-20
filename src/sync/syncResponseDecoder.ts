import protobuf from 'protobufjs';

import { deserializeActualValue } from './crdtValue';
import type { ActualSyncMessage } from '../types';

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
  bytes merkle = 2;
}
`;

const root = protobuf.parse(SYNC_PROTO).root;
const SyncResponse = root.lookupType('SyncResponse');
const Message = root.lookupType('Message');

export type DecodedSyncResponse = {
  messages: ActualSyncMessage[];
  encryptedEnvelopeCount: number;
};

export function decodeUnencryptedSyncResponse(payload: Uint8Array): DecodedSyncResponse {
  const decoded = SyncResponse.decode(payload) as unknown as {
    messages?: Array<{
      timestamp?: string;
      isEncrypted?: boolean;
      content?: Uint8Array;
    }>;
  };

  const messages: ActualSyncMessage[] = [];
  let encryptedEnvelopeCount = 0;

  for (const envelope of decoded.messages ?? []) {
    if (envelope.isEncrypted) {
      encryptedEnvelopeCount += 1;
      continue;
    }

    if (!envelope.content) {
      continue;
    }

    const message = Message.decode(envelope.content) as unknown as {
      dataset: string;
      row: string;
      column: string;
      value: string;
    };

    messages.push({
      column: message.column,
      dataset: message.dataset,
      row: message.row,
      timestamp: envelope.timestamp,
      value: deserializeActualValue(message.value),
    });
  }

  return { encryptedEnvelopeCount, messages };
}
