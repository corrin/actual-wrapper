import notifee, { AndroidImportance } from '@notifee/react-native';
import { Platform } from 'react-native';

const TRANSACTION_CHANNEL_ID = 'actual-wrapper-transactions';

export type LocalNotification = {
  body: string;
  data?: Record<string, string>;
  title: string;
};

export async function displayLocalNotification({
  body,
  data,
  title,
}: LocalNotification): Promise<void> {
  const android = Platform.OS === 'android'
    ? {
        channelId: await ensureTransactionChannel(),
        pressAction: { id: 'default' },
      }
    : undefined;

  await notifee.displayNotification({
    android,
    body,
    data,
    title,
  });
}

export async function setApplicationBadgeCount(count: number): Promise<void> {
  await notifee.setBadgeCount(count);
}

async function ensureTransactionChannel(): Promise<string> {
  await notifee.createChannel({
    id: TRANSACTION_CHANNEL_ID,
    importance: AndroidImportance.DEFAULT,
    name: 'Transaction updates',
  });
  return TRANSACTION_CHANNEL_ID;
}
