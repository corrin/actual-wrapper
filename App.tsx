import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  WebView,
  type WebViewMessageEvent,
  type WebViewNavigation,
} from 'react-native-webview';
import type {
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
  WebViewNavigationEvent,
} from 'react-native-webview/lib/WebViewTypes';

import { getAddTransactionPrefill } from './src/bridge/addTransactionPreprocessor';
import { buildActualBridgeScript } from './src/bridge/actualBridgeScript';
import { parseBridgeMessage } from './src/bridge/messages';
import {
  clearAppConfig,
  loadAppConfig,
  saveAppConfig,
} from './src/storage/appConfig';
import {
  clearActualCredentials,
  loadActualCredentialPresence,
  loadActualCredentials,
  saveActualCredentials,
  type ActualCredentialPresence,
  type ActualCredentials,
} from './src/storage/actualCredentials';
import {
  appendDiagnosticEvent,
  clearDiagnosticEvents,
  clearLastSetupError,
  loadDiagnosticEvents,
  loadLastSetupError,
  saveLastSetupError,
  subscribeToDiagnosticEvents,
  type SetupDiagnostic,
} from './src/storage/diagnostics';
import { buildActualAuthSeedScript } from './src/bridge/actualAuthSeedScript';
import {
  getActualLoginMethods,
  loginToActualWithPassword,
} from './src/auth/actualAuth';
import { normalizeServerUrl, sameOrigin } from './src/web/urlPolicy';
import type { AppConfig } from './src/types';
import {
  loadDebugServerUrl,
  saveDebugServerUrl,
} from './src/storage/debugConfig';
import {
  normalizeDebugServerUrl,
  parseDebugCommand,
  type DebugClientMessage,
  type DebugCommand,
} from './src/debug/debugControl';
import { DEBUG_MODE_WARNING, isUnsafeDebugMode } from './src/debug/debugMode';
import {
  displayLocalNotification,
  setApplicationBadgeCount,
} from './src/notifications/localNotifications';

export default function App() {
  const unsafeDebugMode = isUnsafeDebugMode();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [credentials, setCredentials] = useState<ActualCredentials | null>(null);
  const [credentialPresence, setCredentialPresence] =
    useState<ActualCredentialPresence>({
      hasEncryptionPassword: false,
      hasServerPassword: false,
      hasToken: false,
    });
  const [draftUrl, setDraftUrl] = useState('');
  const [draftPassword, setDraftPassword] = useState('');
  const [draftEncryptionPassword, setDraftEncryptionPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingSetup, setSavingSetup] = useState(false);
  const [requestedUrl, setRequestedUrl] = useState<string | null>(null);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [debugServerUrl, setDebugServerUrl] = useState<string | null>(null);
  const [draftDebugServerUrl, setDraftDebugServerUrl] = useState('');
  const [debugReconnectAttempt, setDebugReconnectAttempt] = useState(0);
  const [launchWarningVisible, setLaunchWarningVisible] =
    useState(unsafeDebugMode);
  const [lastSetupError, setLastSetupError] = useState<SetupDiagnostic | null>(
    null,
  );
  const webViewRef = useRef<WebView>(null);
  const debugSocketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    void Promise.all([
      loadAppConfig(),
      loadActualCredentials(),
      loadActualCredentialPresence(),
      loadLastSetupError(),
      loadDebugServerUrl(),
    ]).then(
      ([
        storedConfig,
        storedCredentials,
        storedPresence,
        storedSetupError,
        storedDebugServerUrl,
      ]) => {
        setConfig(storedConfig);
        setCredentials(storedCredentials);
        setCredentialPresence(storedPresence);
        setLastSetupError(storedSetupError);
        setDebugServerUrl(storedDebugServerUrl);
        setDraftDebugServerUrl(storedDebugServerUrl ?? '');
        setDraftUrl(storedConfig?.serverUrl ?? '');
        setRequestedUrl(
          storedConfig && storedCredentials ? storedConfig.serverUrl : null,
        );
        setLoading(false);
        void appendDiagnosticEvent({
          area: 'app',
          data: {
            hasConfig: Boolean(storedConfig),
            hasCredentials: Boolean(storedCredentials),
            hasSetupError: Boolean(storedSetupError),
          },
          level: 'info',
          message: 'startup complete',
        });
      },
    );
  }, []);

  useEffect(() => {
    if (!unsafeDebugMode) {
      return;
    }

    const timeout = setTimeout(() => {
      setLaunchWarningVisible(false);
    }, 1500);

    return () => {
      clearTimeout(timeout);
    };
  }, [unsafeDebugMode]);

  const currentUrl = useMemo(() => {
    if (!config || !requestedUrl) {
      return null;
    }

    return requestedUrl;
  }, [config, requestedUrl]);

  const injectedScript = useMemo(() => {
    const scriptParts: string[] = [];

    if (config && credentials) {
      scriptParts.push(
        buildActualAuthSeedScript({
          serverUrl: config.serverUrl,
          token: credentials.token,
        }),
      );
    }

    scriptParts.push(
      buildActualBridgeScript(getAddTransactionPrefill(), {
        encryptionPassword: credentials?.encryptionPassword,
      }),
    );

    return scriptParts.join('\n');
  }, [config, credentials]);

  const persistSetup = useCallback(async () => {
    if (savingSetup) {
      return;
    }

    setSavingSetup(true);
    try {
      const serverUrl = normalizeServerUrl(draftUrl);
      await appendDiagnosticEvent({
        area: 'setup',
        data: {
          hasEncryptionPassword: draftEncryptionPassword.length > 0,
          hasServerPassword: draftPassword.length > 0,
          serverUrl,
        },
        level: 'info',
        message: 'setup submitted',
      });
      const serverPassword = draftPassword;
      const encryptionPassword =
        draftEncryptionPassword.length > 0 ? draftEncryptionPassword : null;
      const token = await loginToActualWithPassword({
        password: serverPassword,
        serverUrl,
      });
      const nextConfig: AppConfig = { serverUrl };
      const nextCredentials: ActualCredentials = {
        encryptionPassword,
        serverPassword,
        token,
      };

      await saveActualCredentials(nextCredentials);
      await saveAppConfig(nextConfig);
      await clearLastSetupError();

      setConfig(nextConfig);
      setCredentials(nextCredentials);
      setLastSetupError(null);
      setCredentialPresence({
        hasEncryptionPassword: Boolean(encryptionPassword),
        hasServerPassword: true,
        hasToken: true,
      });
      setDraftPassword('');
      setDraftEncryptionPassword('');
      setRequestedUrl(serverUrl);
      await appendDiagnosticEvent({
        area: 'setup',
        data: {
          serverUrl,
        },
        level: 'info',
        message: 'setup saved',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[ActualWrapperSetup]', message);
      await appendDiagnosticEvent({
        area: 'setup',
        data: {
          error: message,
        },
        level: 'error',
        message: 'setup failed',
      });
      await saveLastSetupError(message);
      setLastSetupError({
        message,
        timestamp: new Date().toISOString(),
      });
      Alert.alert('Setup failed', message);
    } finally {
      setSavingSetup(false);
    }
  }, [draftEncryptionPassword, draftPassword, draftUrl, savingSetup]);

  const shouldStartLoad = useCallback(
    (request: WebViewNavigation) => {
      if (!config || sameOrigin(config.serverUrl, request.url)) {
        void appendDiagnosticEvent({
          area: 'webview',
          data: {
            navigationUrl: request.url,
          },
          level: 'debug',
          message: 'navigation allowed',
        });
        return true;
      }

      void appendDiagnosticEvent({
        area: 'webview',
        data: {
          navigationUrl: request.url,
        },
        level: 'warn',
        message: 'external navigation opened outside app',
      });
      void Linking.openURL(request.url);
      return false;
    },
    [config],
  );

  const handleBridgeMessage = useCallback((event: WebViewMessageEvent) => {
    const message = parseBridgeMessage(event.nativeEvent.data);
    if (!message) {
      return;
    }

    if (message.type === 'actual-wrapper:app-settings-requested') {
      void appendDiagnosticEvent({
        area: 'bridge',
        data: {
          type: message.type,
        },
        level: 'info',
        message: 'settings requested',
      });
      setIsSettingsVisible(true);
      return;
    }

    console.info('[ActualWrapperBridge]', message.type, message.payload ?? {});
    void appendDiagnosticEvent({
      area: 'bridge',
      data: {
        type: message.type,
      },
      level: 'debug',
      message: 'message received',
    });
  }, []);

  const handleWebViewLoadStart = useCallback(
    (event: WebViewNavigationEvent) => {
      void appendDiagnosticEvent({
        area: 'webview',
        data: {
          url: event.nativeEvent.url,
        },
        level: 'info',
        message: 'load started',
      });
    },
    [],
  );

  const handleWebViewLoadEnd = useCallback(
    (event: WebViewNavigationEvent | WebViewErrorEvent) => {
      void appendDiagnosticEvent({
        area: 'webview',
        data: {
          url: event.nativeEvent.url,
        },
        level: 'info',
        message: 'load ended',
      });
    },
    [],
  );

  const handleWebViewError = useCallback((event: WebViewErrorEvent) => {
    void appendDiagnosticEvent({
      area: 'webview',
      data: {
        code: event.nativeEvent.code,
        description: event.nativeEvent.description,
        url: event.nativeEvent.url,
      },
      level: 'error',
      message: 'load error',
    });
  }, []);

  const handleWebViewHttpError = useCallback((event: WebViewHttpErrorEvent) => {
    void appendDiagnosticEvent({
      area: 'webview',
      data: {
        statusCode: event.nativeEvent.statusCode,
        url: event.nativeEvent.url,
      },
      level: 'error',
      message: 'http error',
    });
  }, []);

  const persistDebugServer = useCallback(async () => {
    try {
      const nextDebugServerUrl = normalizeDebugServerUrl(draftDebugServerUrl);
      await saveDebugServerUrl(nextDebugServerUrl);
      setDebugServerUrl(nextDebugServerUrl || null);
      setDraftDebugServerUrl(nextDebugServerUrl);
      await appendDiagnosticEvent({
        area: 'debug-control',
        data: {
          enabled: Boolean(nextDebugServerUrl),
          url: nextDebugServerUrl || null,
        },
        level: 'info',
        message: 'debug server url saved',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('Debug server URL rejected', message);
    }
  }, [draftDebugServerUrl]);

  const resetSavedServer = useCallback(async () => {
    await clearActualCredentials();
    await clearAppConfig();
    await clearLastSetupError();
    setIsSettingsVisible(false);
    setConfig(null);
    setCredentials(null);
    setLastSetupError(null);
    setCredentialPresence({
      hasEncryptionPassword: false,
      hasServerPassword: false,
      hasToken: false,
    });
    setDraftUrl('');
    setDraftPassword('');
    setDraftEncryptionPassword('');
    setRequestedUrl(null);
  }, []);

  const getDebugState = useCallback(
    () => ({
      currentUrl,
      hasConfig: Boolean(config),
      hasCredentials: Boolean(credentials),
      lastSetupError: lastSetupError?.message ?? null,
      requestedUrl,
      storedCredentials: credentialPresence,
    }),
    [
      config,
      credentialPresence,
      credentials,
      currentUrl,
      lastSetupError?.message,
      requestedUrl,
    ],
  );

  const runDebugCommand = useCallback(
    async (command: DebugCommand) => {
      switch (command.type) {
        case 'get-state':
          return getDebugState();
        case 'clear-diagnostics':
          await clearDiagnosticEvents();
          await clearLastSetupError();
          setLastSetupError(null);
          return { cleared: true };
        case 'reset-setup':
          await resetSavedServer();
          return { reset: true };
        case 'reload-webview':
          webViewRef.current?.reload();
          return { reloaded: true };
        case 'navigate-webview': {
          const url = command.payload?.url;
          if (typeof url !== 'string' || !url.trim()) {
            throw new Error('navigate-webview requires payload.url.');
          }
          new URL(url);
          setRequestedUrl(url);
          return { url };
        }
        case 'test-notification':
          return {
            displayed: true,
            settings: await displayLocalNotification({
              body: 'Debug notification from Actual Wrapper.',
              title: 'Actual Wrapper debug',
            }),
          };
        case 'set-badge': {
          const count = command.payload?.count;
          if (typeof count !== 'number' || count < 0) {
            throw new Error('set-badge requires payload.count >= 0.');
          }
          return {
            count,
            settings: await setApplicationBadgeCount(count),
          };
        }
        case 'run-auth-probe': {
          if (!config) {
            throw new Error('No Actual server is configured.');
          }
          const methods = await getActualLoginMethods(config.serverUrl);
          return {
            methods: methods.map(method => ({
              active: Boolean(method.active),
              method: method.method,
            })),
          };
        }
        default:
          throw new Error(`Unknown debug command: ${command.type}`);
      }
    },
    [config, getDebugState, resetSavedServer],
  );

  useEffect(() => {
    if (!unsafeDebugMode || !debugServerUrl) {
      return;
    }

    let closed = false;
    const socket = new WebSocket(debugServerUrl);
    debugSocketRef.current = socket;

    const sendDebugMessage = (message: Omit<DebugClientMessage, 'timestamp'>) => {
      if (closed || socket.readyState !== 1) {
        return;
      }

      socket.send(
        JSON.stringify({
          ...message,
          timestamp: new Date().toISOString(),
        } satisfies DebugClientMessage),
      );
    };

    const unsubscribe = subscribeToDiagnosticEvents(event => {
      sendDebugMessage({
        payload: { event },
        type: 'log',
      });
    });

    socket.onopen = () => {
      void appendDiagnosticEvent({
        area: 'debug-control',
        data: {
          url: debugServerUrl,
        },
        level: 'info',
        message: 'connected',
      });

      sendDebugMessage({
        payload: {
          app: 'Actual Wrapper',
          state: getDebugState(),
        },
        type: 'hello',
      });

      void loadDiagnosticEvents().then(events => {
        for (const event of events) {
          sendDebugMessage({
            payload: { event },
            type: 'log',
          });
        }
      });
    };

    socket.onmessage = event => {
      let command: DebugCommand | null = null;
      try {
        command = parseDebugCommand(String(event.data));
      } catch (error) {
        sendDebugMessage({
          payload: {
            error: error instanceof Error ? error.message : String(error),
          },
          type: 'command-error',
        });
        return;
      }

      if (!command) {
        sendDebugMessage({
          payload: {
            error: 'Invalid debug command.',
          },
          type: 'command-error',
        });
        return;
      }

      void runDebugCommand(command)
        .then(result => {
          sendDebugMessage({
            id: command.id,
            payload: { result },
            type: 'command-result',
          });
        })
        .catch(error => {
          sendDebugMessage({
            id: command.id,
            payload: {
              error: error instanceof Error ? error.message : String(error),
            },
            type: 'command-error',
          });
        });
    };

    socket.onerror = () => {
      void appendDiagnosticEvent({
        area: 'debug-control',
        data: {
          url: debugServerUrl,
        },
        level: 'error',
        message: 'socket error',
      });
    };

    socket.onclose = () => {
      if (!closed) {
        void appendDiagnosticEvent({
          area: 'debug-control',
          data: {
            url: debugServerUrl,
          },
          level: 'warn',
          message: 'socket closed',
        });
        setTimeout(() => {
          setDebugReconnectAttempt(attempt => attempt + 1);
        }, 2000);
      }
    };

    return () => {
      closed = true;
      unsubscribe();
      if (debugSocketRef.current === socket) {
        debugSocketRef.current = null;
      }
      socket.close();
    };
  }, [
    debugReconnectAttempt,
    debugServerUrl,
    getDebugState,
    runDebugCommand,
    unsafeDebugMode,
  ]);

  const setupContent = (
    <SafeAreaView style={styles.setup}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.setupContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Actual Wrapper</Text>
        <Text style={styles.label}>Actual server URL</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onChangeText={setDraftUrl}
          placeholder="https://budget.example.com"
          style={styles.input}
          value={draftUrl}
        />
        <Text style={styles.label}>Actual server password</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setDraftPassword}
          placeholder="Server password"
          secureTextEntry
          style={styles.input}
          value={draftPassword}
        />
        <Text style={styles.label}>Budget encryption password (optional)</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setDraftEncryptionPassword}
          placeholder="Leave blank if your budget is not encrypted"
          secureTextEntry
          style={styles.input}
          value={draftEncryptionPassword}
        />
        {lastSetupError ? (
          <>
            <Text style={styles.diagnosticTitle}>Last setup error</Text>
            <Text selectable style={styles.diagnosticText}>
              {lastSetupError.timestamp}
              {'\n'}
              {lastSetupError.message}
            </Text>
          </>
        ) : null}
        {unsafeDebugMode ? (
          <>
            <Text style={styles.diagnosticTitle}>Debug control</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              onChangeText={setDraftDebugServerUrl}
              placeholder="ws://192.168.1.10:35561"
              style={styles.input}
              value={draftDebugServerUrl}
            />
            <Pressable
              onPress={persistDebugServer}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>
                Save debug server
              </Text>
            </Pressable>
          </>
        ) : null}
        <Pressable
          disabled={savingSetup}
          onPress={persistSetup}
          style={[styles.primaryButton, savingSetup && styles.disabledButton]}
        >
          <Text style={styles.primaryButtonText}>
            {savingSetup ? 'Checking Actual login...' : 'Save setup'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );

  if (loading || launchWarningVisible) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.centered}>
          <ActivityIndicator />
          {unsafeDebugMode ? (
            <Text style={styles.debugLaunchWarning}>{DEBUG_MODE_WARNING}</Text>
          ) : null}
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (!config || !credentials || !currentUrl) {
    return <SafeAreaProvider>{setupContent}</SafeAreaProvider>;
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <WebView
          allowsBackForwardNavigationGestures
          geolocationEnabled
          injectedJavaScriptBeforeContentLoaded={injectedScript}
          onError={handleWebViewError}
          onHttpError={handleWebViewHttpError}
          onLoadEnd={handleWebViewLoadEnd}
          onLoadStart={handleWebViewLoadStart}
          onMessage={handleBridgeMessage}
          onShouldStartLoadWithRequest={shouldStartLoad}
          ref={webViewRef}
          source={{ uri: currentUrl }}
          style={styles.webView}
        />
        <Modal
          animationType="fade"
          onRequestClose={() => setIsSettingsVisible(false)}
          transparent
          visible={isSettingsVisible}
        >
          <Pressable
            onPress={() => setIsSettingsVisible(false)}
            style={styles.modalBackdrop}
          >
            <Pressable style={styles.settingsPanel}>
              <Text style={styles.settingsTitle}>App Settings</Text>
              <Text style={styles.settingsLabel}>Actual server</Text>
              <Text numberOfLines={2} style={styles.settingsValue}>
                {config.serverUrl}
              </Text>
              <Text style={styles.settingsLabel}>Stored credentials</Text>
              <Text style={styles.settingsValue}>
                Token: {credentialPresence.hasToken ? 'yes' : 'no'}
              </Text>
              <Text style={styles.settingsValue}>
                Server password:{' '}
                {credentialPresence.hasServerPassword ? 'yes' : 'no'}
              </Text>
              <Text style={styles.settingsValue}>
                Encryption password:{' '}
                {credentialPresence.hasEncryptionPassword ? 'yes' : 'no'}
              </Text>
              {lastSetupError ? (
                <>
                  <Text style={styles.settingsLabel}>Last setup error</Text>
                  <Text selectable style={styles.diagnosticText}>
                    {lastSetupError.timestamp}
                    {'\n'}
                    {lastSetupError.message}
                  </Text>
                </>
              ) : null}
              {unsafeDebugMode ? (
                <>
                  <Text style={styles.settingsLabel}>Debug control</Text>
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    onChangeText={setDraftDebugServerUrl}
                    placeholder="ws://192.168.1.10:35561"
                    style={styles.input}
                    value={draftDebugServerUrl}
                  />
                  <Pressable
                    onPress={persistDebugServer}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>
                      Save debug server
                    </Text>
                  </Pressable>
                  <Text style={styles.settingsValue}>
                    Active:{' '}
                    {debugServerUrl && debugSocketRef.current ? 'yes' : 'no'}
                  </Text>
                </>
              ) : null}
              <Pressable
                onPress={resetSavedServer}
                style={styles.destructiveButton}
              >
                <Text style={styles.destructiveButtonText}>
                  Reset app setup
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setIsSettingsVisible(false)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Close</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  container: {
    backgroundColor: '#f8fafc',
    flex: 1,
  },
  debugLaunchWarning: {
    backgroundColor: '#b91c1c',
    borderRadius: 6,
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.65,
  },
  diagnosticText: {
    backgroundColor: '#e2e8f0',
    borderRadius: 6,
    color: '#0f172a',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
    padding: 10,
  },
  diagnosticTitle: {
    color: '#7f1d1d',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    borderColor: '#94a3b8',
    borderRadius: 6,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  destructiveButton: {
    alignItems: 'center',
    backgroundColor: '#b91c1c',
    borderRadius: 6,
    justifyContent: 'center',
    minHeight: 44,
    marginTop: 18,
  },
  destructiveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  label: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 6,
    justifyContent: 'center',
    minHeight: 48,
    marginTop: 16,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#cbd5e1',
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    marginTop: 10,
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
  },
  setupContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  setup: {
    backgroundColor: '#f8fafc',
    flex: 1,
  },
  title: {
    color: '#0f172a',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 28,
  },
  settingsLabel: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  settingsPanel: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 18,
    width: '100%',
    maxWidth: 360,
  },
  settingsTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 18,
  },
  settingsValue: {
    color: '#0f172a',
    fontSize: 14,
  },
  webView: {
    flex: 1,
  },
});
