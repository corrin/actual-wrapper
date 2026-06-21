export type AppConfig = {
  budget: ActualBudgetConfig;
  serverUrl: string;
};

export type ActualBudgetConfig = {
  encryptKeyId: string | null;
  encryptSalt: string | null;
  fileId: string;
  groupId: string;
  name: string;
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
