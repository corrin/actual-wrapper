import { describe, expect, it } from 'vitest';

import { detectNewTransactions } from '../src/sync/transactionDetector';
import type { ActualSyncMessage, SyncCursor } from '../src/types';

const emptyCursor: SyncCursor = {
  knownTransactionRows: [],
  lastSyncTimestamp: null,
};

function transactionMessage(
  row: string,
  column: string,
  value: unknown,
): ActualSyncMessage {
  return {
    column,
    dataset: 'transactions',
    row,
    value,
  };
}

describe('detectNewTransactions', () => {
  it('detects a new transaction row from transaction messages', () => {
    const result = detectNewTransactions(emptyCursor, [
      transactionMessage('tx-1', 'amount', 1200),
      transactionMessage('tx-1', 'payee', 'payee-1'),
    ]);

    expect(result.newTransactionRows).toEqual(['tx-1']);
    expect(result.knownTransactionRows).toEqual(['tx-1']);
  });

  it('does not notify for updates to a known transaction row', () => {
    const result = detectNewTransactions(
      { knownTransactionRows: ['tx-1'], lastSyncTimestamp: '100' },
      [transactionMessage('tx-1', 'notes', 'updated')],
    );

    expect(result.newTransactionRows).toEqual([]);
    expect(result.knownTransactionRows).toEqual(['tx-1']);
  });

  it('ignores non-transaction datasets', () => {
    const result = detectNewTransactions(emptyCursor, [
      {
        column: 'name',
        dataset: 'payees',
        row: 'payee-1',
        value: 'Coffee',
      },
    ]);

    expect(result.newTransactionRows).toEqual([]);
    expect(result.knownTransactionRows).toEqual([]);
  });

  it('does not notify for tombstoned transaction rows', () => {
    const result = detectNewTransactions(emptyCursor, [
      transactionMessage('tx-1', 'amount', 1200),
      transactionMessage('tx-1', 'tombstone', 1),
    ]);

    expect(result.newTransactionRows).toEqual([]);
    expect(result.knownTransactionRows).toEqual([]);
  });

  it('removes tombstoned known rows from local known state', () => {
    const result = detectNewTransactions(
      { knownTransactionRows: ['tx-1', 'tx-2'], lastSyncTimestamp: '100' },
      [transactionMessage('tx-1', 'tombstone', 1)],
    );

    expect(result.newTransactionRows).toEqual([]);
    expect(result.knownTransactionRows).toEqual(['tx-2']);
  });
});
