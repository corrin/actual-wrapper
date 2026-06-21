import notifee, {
  AndroidImportance,
  type NotificationSettings,
} from '@notifee/react-native';
import { Platform } from 'react-native';

const TRANSACTION_CHANNEL_ID = 'actual-wrapper-transactions';

export type LocalNotification = {
  body: string;
  data?: Record<string, string>;
  title: string;
};

export async function ensureNotificationPermission(): Promise<NotificationSettings> {
  return notifee.requestPermission();
}

export async function displayLocalNotification({
  body,
  data,
  title,
}: LocalNotification): Promise<NotificationSettings> {
  const settings = await ensureNotificationPermission();
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
  return settings;
}

export async function setApplicationBadgeCount(
  count: number,
): Promise<NotificationSettings> {
  const settings = await ensureNotificationPermission();
  await notifee.setBadgeCount(count);
  return settings;
}

async function ensureTransactionChannel(): Promise<string> {
  await notifee.createChannel({
    id: TRANSACTION_CHANNEL_ID,
    importance: AndroidImportance.DEFAULT,
    name: 'Transaction updates',
  });
  return TRANSACTION_CHANNEL_ID;
}
