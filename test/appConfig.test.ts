import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearAppConfig,
  loadAppConfig,
  saveAppConfig,
} from '../src/storage/appConfig';

const storage = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    async getItem(key: string) {
      return storage.get(key) ?? null;
    },
    async removeItem(key: string) {
      storage.delete(key);
    },
    async setItem(key: string, value: string) {
      storage.set(key, value);
    },
  },
}));

describe('appConfig storage', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('loads null when no app config is stored', async () => {
    await expect(loadAppConfig()).resolves.toBeNull();
  });

  it('saves and loads app config', async () => {
    await saveAppConfig({
      budget: {
        encryptKeyId: null,
        encryptSalt: null,
        fileId: 'file-id',
        groupId: 'group-id',
        name: 'Budget',
      },
      serverUrl: 'https://budget.example.com/',
    });

    await expect(loadAppConfig()).resolves.toEqual({
      budget: {
        encryptKeyId: null,
        encryptSalt: null,
        fileId: 'file-id',
        groupId: 'group-id',
        name: 'Budget',
      },
      serverUrl: 'https://budget.example.com/',
    });
  });

  it('clears app config', async () => {
    await saveAppConfig({
      budget: {
        encryptKeyId: null,
        encryptSalt: null,
        fileId: 'file-id',
        groupId: 'group-id',
        name: 'Budget',
      },
      serverUrl: 'https://budget.example.com/',
    });
    await clearAppConfig();

    await expect(loadAppConfig()).resolves.toBeNull();
  });
});
