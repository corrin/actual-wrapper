import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_SETUP_ERROR_KEY = 'actual-wrapper:last-setup-error:v1';
const DIAGNOSTIC_EVENTS_KEY = 'actual-wrapper:diagnostic-events:v1';
const MAX_DIAGNOSTIC_EVENTS = 200;
const diagnosticListeners = new Set<(event: DiagnosticEvent) => void>();

type DiagnosticPrimitive = string | number | boolean | null;

export type DiagnosticEvent = {
  area: string;
  data?: Record<string, DiagnosticPrimitive>;
  level: 'debug' | 'error' | 'info' | 'warn';
  message: string;
  timestamp: string;
};

export type SetupDiagnostic = {
  message: string;
  timestamp: string;
};

export function isDiagnosticsEnabled(): boolean {
  if (typeof __DEV__ === 'boolean') {
    return __DEV__;
  }

  return process.env.NODE_ENV === 'test';
}

export async function loadLastSetupError(): Promise<SetupDiagnostic | null> {
  if (!isDiagnosticsEnabled()) {
    return null;
  }

  const rawDiagnostic = await AsyncStorage.getItem(LAST_SETUP_ERROR_KEY);
  if (!rawDiagnostic) {
    return null;
  }

  return JSON.parse(rawDiagnostic) as SetupDiagnostic;
}

export async function saveLastSetupError(message: string): Promise<void> {
  if (!isDiagnosticsEnabled()) {
    return;
  }

  await AsyncStorage.setItem(
    LAST_SETUP_ERROR_KEY,
    JSON.stringify({
      message,
      timestamp: new Date().toISOString(),
    } satisfies SetupDiagnostic),
  );
}

export async function clearLastSetupError(): Promise<void> {
  if (!isDiagnosticsEnabled()) {
    return;
  }

  await AsyncStorage.removeItem(LAST_SETUP_ERROR_KEY);
}

export async function loadDiagnosticEvents(): Promise<DiagnosticEvent[]> {
  if (!isDiagnosticsEnabled()) {
    return [];
  }

  const rawEvents = await AsyncStorage.getItem(DIAGNOSTIC_EVENTS_KEY);
  if (!rawEvents) {
    return [];
  }

  const parsed = JSON.parse(rawEvents) as unknown;
  return Array.isArray(parsed) ? (parsed as DiagnosticEvent[]) : [];
}

export async function appendDiagnosticEvent(
  event: Omit<DiagnosticEvent, 'timestamp'>,
): Promise<void> {
  if (!isDiagnosticsEnabled()) {
    return;
  }

  const events = await loadDiagnosticEvents();
  const diagnosticEvent = {
    ...event,
    data: event.data ? redactDiagnosticData(event.data) : undefined,
    timestamp: new Date().toISOString(),
  };
  events.push(diagnosticEvent);

  await AsyncStorage.setItem(
    DIAGNOSTIC_EVENTS_KEY,
    JSON.stringify(events.slice(-MAX_DIAGNOSTIC_EVENTS)),
  );
  notifyDiagnosticListeners(diagnosticEvent);
}

export async function clearDiagnosticEvents(): Promise<void> {
  if (!isDiagnosticsEnabled()) {
    return;
  }

  await AsyncStorage.removeItem(DIAGNOSTIC_EVENTS_KEY);
}

function redactDiagnosticData(
  data: Record<string, DiagnosticPrimitive>,
): Record<string, DiagnosticPrimitive> {
  const redacted: Record<string, DiagnosticPrimitive> = {};

  for (const [key, value] of Object.entries(data)) {
    redacted[key] = shouldRedactDiagnosticKey(key) ? '[redacted]' : value;
  }

  return redacted;
}

function shouldRedactDiagnosticKey(key: string): boolean {
  return /password|token|secret|key/i.test(key);
}

export function subscribeToDiagnosticEvents(
  listener: (event: DiagnosticEvent) => void,
): () => void {
  diagnosticListeners.add(listener);
  return () => {
    diagnosticListeners.delete(listener);
  };
}

function notifyDiagnosticListeners(event: DiagnosticEvent): void {
  for (const listener of diagnosticListeners) {
    listener(event);
  }
}
