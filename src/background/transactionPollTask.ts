import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

const TRANSACTION_POLL_TASK = 'actual-wrapper:transaction-poll';

TaskManager.defineTask(TRANSACTION_POLL_TASK, async () => {
  // The concrete Actual sync client is added after the sync feasibility spike.
  return BackgroundTask.BackgroundTaskResult.Success;
});

export async function registerTransactionPollTask(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(TRANSACTION_POLL_TASK);
  if (isRegistered) {
    return;
  }

  await BackgroundTask.registerTaskAsync(TRANSACTION_POLL_TASK, {
    minimumInterval: 60 * 15,
  });
}
