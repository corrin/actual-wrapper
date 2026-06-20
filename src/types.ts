export type AppConfig = {
  serverUrl: string;
};

export type SyncCursor = {
  lastSyncTimestamp: string | null;
  knownTransactionRows: string[];
};

export type ActualSyncMessage = {
  dataset: string;
  row: string;
  column: string;
  value: unknown;
  timestamp?: string;
};

export type TransactionDetectionResult = {
  newTransactionRows: string[];
  knownTransactionRows: string[];
};
