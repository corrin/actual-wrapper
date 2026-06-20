import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppConfig } from '../types';

const APP_CONFIG_KEY = 'actual-wrapper:app-config:v1';

export async function loadAppConfig(): Promise<AppConfig | null> {
  const rawConfig = await AsyncStorage.getItem(APP_CONFIG_KEY);
  if (!rawConfig) {
    return null;
  }

  return JSON.parse(rawConfig) as AppConfig;
}

export async function saveAppConfig(config: AppConfig): Promise<void> {
  await AsyncStorage.setItem(APP_CONFIG_KEY, JSON.stringify(config));
}
