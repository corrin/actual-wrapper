import protobuf from 'protobufjs';

import { deserializeActualValue } from './crdtValue';
import type { ActualBudgetConfig, ActualSyncMessage } from '../types';
import {
  decryptActualPayload,
  deriveActualEncryptionKey,
  type ActualEncryptionKey,
} from './actualEncryption';

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
const SyncResponse = root.lookupType('SyncResponse');
const SyncRequest = root.lookupType('SyncRequest');
const Message = root.lookupType('Message');

export type DecodedSyncResponse = {
  messages: ActualSyncMessage[];
};

export function encodeSyncRequest({
  budget,
  since,
}: {
  budget: ActualBudgetConfig;
  since: string;
}): Uint8Array {
  return SyncRequest.encode(
    SyncRequest.create({
      fileId: budget.fileId,
      groupId: budget.groupId,
      keyId: budget.encryptKeyId ?? '',
      messages: [],
      since,
    }),
  ).finish();
}

export function decodeSyncResponse({
  budget,
  encryptionPassword,
  payload,
}: {
  budget: ActualBudgetConfig;
  encryptionPassword: string | null;
  payload: Uint8Array;
}): DecodedSyncResponse {
  const decoded = SyncResponse.decode(payload) as unknown as {
    messages?: Array<{
      timestamp?: string;
      isEncrypted?: boolean;
      content?: Uint8Array;
    }>;
  };

  const messages: ActualSyncMessage[] = [];
  const encryptionKey = buildEncryptionKey({ budget, encryptionPassword });

  for (const envelope of decoded.messages ?? []) {
    if (!envelope.content) {
      continue;
    }

    const content = envelope.isEncrypted
      ? decryptEnvelopeContent(envelope.content, encryptionKey)
      : envelope.content;

    const message = Message.decode(content) as unknown as {
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

  return { messages };
}

export function decodeUnencryptedSyncResponse(
  payload: Uint8Array,
): DecodedSyncResponse {
  return decodeSyncResponse({
    budget: {
      encryptKeyId: null,
      encryptSalt: null,
      fileId: 'unencrypted-test-file',
      groupId: 'unencrypted-test-group',
      name: 'Unencrypted test budget',
    },
    encryptionPassword: null,
    payload,
  });
}

function buildEncryptionKey({
  budget,
  encryptionPassword,
}: {
  budget: ActualBudgetConfig;
  encryptionPassword: string | null;
}): ActualEncryptionKey | null {
  if (!budget.encryptKeyId) {
    return null;
  }

  if (!budget.encryptSalt || !encryptionPassword) {
    throw new Error('Actual budget is encrypted; encryption password is required.');
  }

  return deriveActualEncryptionKey({
    id: budget.encryptKeyId,
    password: encryptionPassword,
    salt: budget.encryptSalt,
  });
}

function decryptEnvelopeContent(
  content: Uint8Array,
  encryptionKey: ActualEncryptionKey | null,
): Uint8Array {
  if (!encryptionKey) {
    throw new Error(
      'Actual sync response contains encrypted messages; decrypt before counting transactions.',
    );
  }

  const encryptedData = EncryptedData.decode(content) as unknown as {
    authTag?: Uint8Array;
    data?: Uint8Array;
    iv?: Uint8Array;
  };

  if (!encryptedData.authTag || !encryptedData.data || !encryptedData.iv) {
    throw new Error('Actual sync response contains unreadable encrypted data.');
  }

  return decryptActualPayload(encryptionKey, {
    authTag: encryptedData.authTag,
    data: encryptedData.data,
    iv: encryptedData.iv,
  });
}
