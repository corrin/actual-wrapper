import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearActualCredentials,
  loadActualCredentialPresence,
  loadActualCredentials,
  saveActualCredentials,
} from '../src/storage/actualCredentials';

const secureStorage = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
  async deleteItemAsync(key: string) {
    secureStorage.delete(key);
  },
  async getItemAsync(key: string) {
    return secureStorage.get(key) ?? null;
  },
  async setItemAsync(key: string, value: string) {
    secureStorage.set(key, value);
  },
}));

describe('Actual credential storage', () => {
  beforeEach(() => {
    secureStorage.clear();
  });

  it('loads null until password and token exist', async () => {
    await expect(loadActualCredentials()).resolves.toBeNull();
  });

  it('saves and loads credentials', async () => {
    await saveActualCredentials({
      encryptionPassword: 'budget-secret',
      serverPassword: 'server-secret',
      token: 'actual-token',
    });

    await expect(loadActualCredentials()).resolves.toEqual({
      encryptionPassword: 'budget-secret',
      serverPassword: 'server-secret',
      token: 'actual-token',
    });
    await expect(loadActualCredentialPresence()).resolves.toEqual({
      hasEncryptionPassword: true,
      hasServerPassword: true,
      hasToken: true,
    });
  });

  it('clears all credentials', async () => {
    await saveActualCredentials({
      encryptionPassword: 'budget-secret',
      serverPassword: 'server-secret',
      token: 'actual-token',
    });

    await clearActualCredentials();

    await expect(loadActualCredentials()).resolves.toBeNull();
    await expect(loadActualCredentialPresence()).resolves.toEqual({
      hasEncryptionPassword: false,
      hasServerPassword: false,
      hasToken: false,
    });
  });
});
