import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearDebugServerUrl,
  loadDebugServerUrl,
  saveDebugServerUrl,
} from '../src/storage/debugConfig';

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

describe('debug config storage', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('saves and clears the debug server URL', async () => {
    await saveDebugServerUrl(' ws://192.168.1.10:35561/ws ');
    await expect(loadDebugServerUrl()).resolves.toBe(
      'ws://192.168.1.10:35561/ws',
    );

    await clearDebugServerUrl();
    await expect(loadDebugServerUrl()).resolves.toBeNull();
  });
});
