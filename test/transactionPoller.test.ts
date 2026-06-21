import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadSyncCursor, saveSyncCursor } from '../src/storage/syncCursor';
import {
  pollForNewTransactions,
  type ActualSyncClient,
} from '../src/sync/transactionPoller';
import type { ActualSyncMessage } from '../src/types';

const mocks = vi.hoisted(() => ({
  scheduleNotificationAsync: vi.fn(),
  storage: new Map<string, string>(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    async getItem(key: string) {
      return mocks.storage.get(key) ?? null;
    },
    async removeItem(key: string) {
      mocks.storage.delete(key);
    },
    async setItem(key: string, value: string) {
      mocks.storage.set(key, value);
    },
  },
}));

vi.mock('expo-notifications', () => ({
  scheduleNotificationAsync: mocks.scheduleNotificationAsync,
}));

function transactionMessage(row: string, column: string): ActualSyncMessage {
  return {
    column,
    dataset: 'transactions',
    row,
    value: 'value',
  };
}

function payeeMessage(row: string): ActualSyncMessage {
  return {
    column: 'name',
    dataset: 'payees',
    row,
    value: 'Coffee',
  };
}

function syncClient(
  messages: ActualSyncMessage[],
  nextSyncTimestamp = '200',
): ActualSyncClient {
  return {
    fetchMessagesSince: vi.fn().mockResolvedValue({
      messages,
      nextSyncTimestamp,
    }),
  };
}

describe('pollForNewTransactions', () => {
  beforeEach(() => {
    mocks.storage.clear();
    mocks.scheduleNotificationAsync.mockReset();
  });

  it('sends one aggregate notification for distinct new transaction rows', async () => {
    const client = syncClient([
      transactionMessage('tx-1', 'amount'),
      transactionMessage('tx-1', 'payee'),
      transactionMessage('tx-2', 'amount'),
      payeeMessage('payee-1'),
    ]);

    const result = await pollForNewTransactions(client);

    expect(result.notifiedRows).toEqual(['tx-1', 'tx-2']);
    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        body: '2 new transactions are available in Actual.',
        data: { route: '/accounts' },
        title: 'Actual Budget',
      },
      trigger: null,
    });
    await expect(loadSyncCursor()).resolves.toEqual({
      knownTransactionRows: ['tx-1', 'tx-2'],
      lastSyncTimestamp: '200',
    });
  });

  it('uses singular copy for one new transaction row', async () => {
    await pollForNewTransactions(syncClient([transactionMessage('tx-1', 'amount')]));

    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        body: 'A new transaction is available in Actual.',
        data: { route: '/accounts' },
        title: 'Actual Budget',
      },
      trigger: null,
    });
  });

  it('does not notify for known rows or non-transaction messages', async () => {
    await saveSyncCursor({
      knownTransactionRows: ['tx-1'],
      lastSyncTimestamp: '100',
    });

    const client = syncClient([
      transactionMessage('tx-1', 'notes'),
      payeeMessage('payee-1'),
    ]);

    const result = await pollForNewTransactions(client);

    expect(result.notifiedRows).toEqual([]);
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(client.fetchMessagesSince).toHaveBeenCalledWith('100');
    await expect(loadSyncCursor()).resolves.toEqual({
      knownTransactionRows: ['tx-1'],
      lastSyncTimestamp: '200',
    });
  });

  it('baselines rows and cursor without notifying', async () => {
    const result = await pollForNewTransactions(
      syncClient([
        transactionMessage('tx-1', 'amount'),
        transactionMessage('tx-2', 'amount'),
      ]),
      { baselineOnly: true },
    );

    expect(result.notifiedRows).toEqual([]);
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    await expect(loadSyncCursor()).resolves.toEqual({
      knownTransactionRows: ['tx-1', 'tx-2'],
      lastSyncTimestamp: '200',
    });
  });

  it('does not notify or advance the cursor when polling fails', async () => {
    await saveSyncCursor({
      knownTransactionRows: ['tx-1'],
      lastSyncTimestamp: '100',
    });
    const client: ActualSyncClient = {
      fetchMessagesSince: vi.fn().mockRejectedValue(new Error('decrypt-failure')),
    };

    await expect(pollForNewTransactions(client)).rejects.toThrow('decrypt-failure');

    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    await expect(loadSyncCursor()).resolves.toEqual({
      knownTransactionRows: ['tx-1'],
      lastSyncTimestamp: '100',
    });
  });
});
