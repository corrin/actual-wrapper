import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  appendDiagnosticEvent,
  clearLastSetupError,
  loadDiagnosticEvents,
  loadLastSetupError,
  saveLastSetupError,
  subscribeToDiagnosticEvents,
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

  it('appends diagnostic events and redacts obvious secrets', async () => {
    await appendDiagnosticEvent({
      area: 'actual-auth',
      data: {
        password: 'server-password',
        status: 200,
        token: 'actual-token',
        url: 'https://budget.example.com/account/login',
      },
      level: 'info',
      message: 'response received',
    });

    await expect(loadDiagnosticEvents()).resolves.toMatchObject([
      {
        area: 'actual-auth',
        data: {
          password: '[redacted]',
          status: 200,
          token: '[redacted]',
          url: 'https://budget.example.com/account/login',
        },
        level: 'info',
        message: 'response received',
      },
    ]);
  });

  it('keeps only the most recent diagnostic events', async () => {
    for (let index = 0; index < 205; index += 1) {
      await appendDiagnosticEvent({
        area: 'test',
        data: { index },
        level: 'debug',
        message: 'event',
      });
    }

    const events = await loadDiagnosticEvents();
    expect(events).toHaveLength(200);
    expect(events[0]?.data?.index).toBe(5);
    expect(events[199]?.data?.index).toBe(204);
  });

  it('notifies diagnostic subscribers when an event is appended', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToDiagnosticEvents(listener);

    await appendDiagnosticEvent({
      area: 'debug-control',
      level: 'info',
      message: 'connected',
    });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        area: 'debug-control',
        message: 'connected',
      }),
    );

    unsubscribe();
  });
});
