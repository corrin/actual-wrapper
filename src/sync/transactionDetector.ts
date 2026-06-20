import type {
  ActualSyncMessage,
  SyncCursor,
  TransactionDetectionResult,
} from '../types';

export function detectNewTransactions(
  cursor: SyncCursor,
  messages: ActualSyncMessage[],
): TransactionDetectionResult {
  const knownRows = new Set(cursor.knownTransactionRows);
  const touchedRows = new Set<string>();
  const tombstonedRows = new Set<string>();

  for (const message of messages) {
    if (message.dataset !== 'transactions') {
      continue;
    }

    touchedRows.add(message.row);

    if (message.column === 'tombstone' && message.value === 1) {
      tombstonedRows.add(message.row);
    }
  }

  const newTransactionRows: string[] = [];

  for (const row of touchedRows) {
    if (tombstonedRows.has(row)) {
      knownRows.delete(row);
      continue;
    }

    if (!knownRows.has(row)) {
      newTransactionRows.push(row);
      knownRows.add(row);
    }
  }

  return {
    knownTransactionRows: Array.from(knownRows).sort(),
    newTransactionRows: newTransactionRows.sort(),
  };
}
