import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearActualCredentials,
  loadActualCredentialPresence,
  loadActualCredentials,
  saveActualCredentials,
} from '../src/storage/actualCredentials';

const secureStorage = new Map<string, string>();

vi.mock('react-native-keychain', () => ({
  ACCESSIBLE: {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AfterFirstUnlockThisDeviceOnly',
  },
  async getGenericPassword({ service }: { service: string }) {
    const password = secureStorage.get(service);
    return password ? { password, username: 'actual-wrapper' } : false;
  },
  async resetGenericPassword({ service }: { service: string }) {
    secureStorage.delete(service);
  },
  async setGenericPassword(
    username: string,
    password: string,
    { service }: { service: string },
  ) {
    secureStorage.set(service, password);
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
