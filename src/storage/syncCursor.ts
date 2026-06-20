import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SyncCursor } from '../types';

const SYNC_CURSOR_KEY = 'actual-wrapper:sync-cursor:v1';

export const EMPTY_SYNC_CURSOR: SyncCursor = {
  knownTransactionRows: [],
  lastSyncTimestamp: null,
};

export async function loadSyncCursor(): Promise<SyncCursor> {
  const rawCursor = await AsyncStorage.getItem(SYNC_CURSOR_KEY);
  if (!rawCursor) {
    return EMPTY_SYNC_CURSOR;
  }

  return JSON.parse(rawCursor) as SyncCursor;
}

export async function saveSyncCursor(cursor: SyncCursor): Promise<void> {
  await AsyncStorage.setItem(SYNC_CURSOR_KEY, JSON.stringify(cursor));
}

export async function resetSyncCursor(): Promise<void> {
  await AsyncStorage.removeItem(SYNC_CURSOR_KEY);
}
