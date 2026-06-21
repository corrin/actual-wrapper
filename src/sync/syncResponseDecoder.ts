import { create, fromBinary, toBinary } from '@bufbuild/protobuf';

import {
  EncryptedDataSchema,
  MessageSchema,
  SyncRequestSchema,
  SyncResponseSchema,
} from './actualCrdt';
import { deserializeActualValue } from './crdtValue';
import type { ActualBudgetConfig, ActualSyncMessage } from '../types';
import {
  decryptActualPayload,
  deriveActualEncryptionKey,
  type ActualEncryptionKey,
} from './actualEncryption';

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
  return toBinary(
    SyncRequestSchema,
    create(SyncRequestSchema, {
      fileId: budget.fileId,
      groupId: budget.groupId,
      keyId: budget.encryptKeyId ?? '',
      messages: [],
      since,
    }),
  );
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
  const decoded = fromBinary(SyncResponseSchema, payload);

  const messages: ActualSyncMessage[] = [];
  const encryptionKey = buildEncryptionKey({ budget, encryptionPassword });

  for (const envelope of decoded.messages) {
    if (!envelope.content) {
      continue;
    }

    const content = envelope.isEncrypted
      ? decryptEnvelopeContent(envelope.content, encryptionKey)
      : envelope.content;

    const message = fromBinary(MessageSchema, content);

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

  const encryptedData = fromBinary(EncryptedDataSchema, content);

  if (
    encryptedData.authTag.length === 0 ||
    encryptedData.data.length === 0 ||
    encryptedData.iv.length === 0
  ) {
    throw new Error('Actual sync response contains unreadable encrypted data.');
  }

  return decryptActualPayload(encryptionKey, {
    authTag: encryptedData.authTag,
    data: encryptedData.data,
    iv: encryptedData.iv,
  });
}
