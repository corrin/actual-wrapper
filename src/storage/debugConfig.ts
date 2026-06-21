import AsyncStorage from '@react-native-async-storage/async-storage';

const DEBUG_SERVER_URL_KEY = 'actual-wrapper:debug-server-url:v1';

export async function loadDebugServerUrl(): Promise<string | null> {
  if (typeof __DEV__ === 'boolean' && !__DEV__) {
    return null;
  }

  const url = await AsyncStorage.getItem(DEBUG_SERVER_URL_KEY);
  return url && url.trim().length > 0 ? url : null;
}

export async function saveDebugServerUrl(url: string): Promise<void> {
  if (typeof __DEV__ === 'boolean' && !__DEV__) {
    return;
  }

  await AsyncStorage.setItem(DEBUG_SERVER_URL_KEY, url.trim());
}

export async function clearDebugServerUrl(): Promise<void> {
  if (typeof __DEV__ === 'boolean' && !__DEV__) {
    return;
  }

  await AsyncStorage.removeItem(DEBUG_SERVER_URL_KEY);
}
