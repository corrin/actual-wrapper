import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha512 } from '@noble/hashes/sha2.js';

import { base64ToBytes } from './base64';

type ActualEncryptedPayload = {
  authTag: Uint8Array;
  data: Uint8Array;
  iv: Uint8Array;
};

export type ActualEncryptionKey = {
  id: string;
  key: Uint8Array;
};

export type ActualKeyTestPayload = {
  meta: {
    algorithm: string;
    authTag: string;
    iv: string;
    keyId: string;
  };
  value: string;
};

export function deriveActualEncryptionKey({
  id,
  password,
  salt,
}: {
  id: string;
  password: string;
  salt: string;
}): ActualEncryptionKey {
  return {
    id,
    key: pbkdf2(sha512, utf8Bytes(password), utf8Bytes(salt), {
      c: 10000,
      dkLen: 32,
    }),
  };
}

export function decryptActualPayload(
  key: ActualEncryptionKey,
  payload: ActualEncryptedPayload,
): Uint8Array {
  const encryptedWithTag = concatBytes(payload.data, payload.authTag);
  return gcm(key.key, payload.iv).decrypt(encryptedWithTag);
}

export function validateActualEncryptionKey({
  key,
  test,
}: {
  key: ActualEncryptionKey;
  test: ActualKeyTestPayload;
}): void {
  if (test.meta.algorithm !== 'aes-256-gcm') {
    throw new Error(`Unsupported Actual encryption algorithm: ${test.meta.algorithm}`);
  }

  if (test.meta.keyId !== key.id) {
    throw new Error('Actual encryption key id does not match the selected budget.');
  }

  decryptActualPayload(key, {
    authTag: base64ToBytes(test.meta.authTag),
    data: base64ToBytes(test.value),
    iv: base64ToBytes(test.meta.iv),
  });
}

function concatBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
  const output = new Uint8Array(left.length + right.length);
  output.set(left, 0);
  output.set(right, left.length);
  return output;
}

function utf8Bytes(value: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value);
  }

  const encoded = encodeURIComponent(value);
  const bytes: number[] = [];
  for (let index = 0; index < encoded.length; index += 1) {
    const char = encoded[index];
    if (char === '%') {
      bytes.push(Number.parseInt(encoded.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(char.charCodeAt(0));
    }
  }
  return new Uint8Array(bytes);
}

