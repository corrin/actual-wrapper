import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearLastSetupError,
  loadLastSetupError,
  saveLastSetupError,
} from '../src/storage/diagnostics';

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

describe('diagnostics storage', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('loads null when no setup error is stored', async () => {
    await expect(loadLastSetupError()).resolves.toBeNull();
  });

  it('saves and clears the last setup error', async () => {
    await saveLastSetupError('Actual returned HTML');

    const saved = await loadLastSetupError();
    expect(saved?.message).toBe('Actual returned HTML');
    expect(saved?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    await clearLastSetupError();
    await expect(loadLastSetupError()).resolves.toBeNull();
  });
});
