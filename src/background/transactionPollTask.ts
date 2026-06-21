const TRANSACTION_POLL_TASK = 'actual-wrapper:transaction-poll';

export async function registerTransactionPollTask(): Promise<void> {
  throw new Error(
    `${TRANSACTION_POLL_TASK} native scheduler is not implemented yet.`,
  );
}
