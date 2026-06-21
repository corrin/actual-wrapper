import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_SETUP_ERROR_KEY = 'actual-wrapper:last-setup-error:v1';

export type SetupDiagnostic = {
  message: string;
  timestamp: string;
};

export async function loadLastSetupError(): Promise<SetupDiagnostic | null> {
  const rawDiagnostic = await AsyncStorage.getItem(LAST_SETUP_ERROR_KEY);
  if (!rawDiagnostic) {
    return null;
  }

  return JSON.parse(rawDiagnostic) as SetupDiagnostic;
}

export async function saveLastSetupError(message: string): Promise<void> {
  await AsyncStorage.setItem(
    LAST_SETUP_ERROR_KEY,
    JSON.stringify({
      message,
      timestamp: new Date().toISOString(),
    } satisfies SetupDiagnostic),
  );
}

export async function clearLastSetupError(): Promise<void> {
  await AsyncStorage.removeItem(LAST_SETUP_ERROR_KEY);
}
