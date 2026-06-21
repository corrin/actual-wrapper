import { EMPTY_SYNC_CURSOR, loadSyncCursor, saveSyncCursor } from '../storage/syncCursor';
import type { ActualSyncMessage, SyncCursor } from '../types';
import { displayLocalNotification } from '../notifications/localNotifications';
import { detectNewTransactions } from './transactionDetector';

export type ActualSyncClient = {
  fetchMessagesSince: (lastSyncTimestamp: string | null) => Promise<{
    messages: ActualSyncMessage[];
    nextSyncTimestamp: string | null;
  }>;
};

export type TransactionPollResult = {
  notifiedRows: string[];
  nextCursor: SyncCursor;
};

export async function pollForNewTransactions(
  client: ActualSyncClient,
  options: { baselineOnly?: boolean } = {},
): Promise<TransactionPollResult> {
  const cursor = await loadSyncCursor().catch(() => EMPTY_SYNC_CURSOR);
  const response = await client.fetchMessagesSince(cursor.lastSyncTimestamp);
  const detection = detectNewTransactions(cursor, response.messages);
  const notifiedRows = options.baselineOnly ? [] : detection.newTransactionRows;
  const nextCursor = {
    knownTransactionRows: detection.knownTransactionRows,
    lastSyncTimestamp: response.nextSyncTimestamp ?? cursor.lastSyncTimestamp,
  };

  if (notifiedRows.length > 0) {
    await displayLocalNotification({
      body:
        notifiedRows.length === 1
          ? 'A new transaction is available in Actual.'
          : `${notifiedRows.length} new transactions are available in Actual.`,
      data: { route: '/accounts' },
      title: 'Actual Budget',
    });
  }

  await saveSyncCursor(nextCursor);
  return { nextCursor, notifiedRows };
}
