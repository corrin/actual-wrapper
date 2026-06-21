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
  clearLastSetupError,
  loadLastSetupError,
  saveLastSetupError,
  type SetupDiagnostic,
} from './src/storage/diagnostics';
import { buildActualAuthSeedScript } from './src/bridge/actualAuthSeedScript';
import { loginToActualWithPassword } from './src/auth/actualAuth';
import { normalizeServerUrl, sameOrigin } from './src/web/urlPolicy';
import type { AppConfig } from './src/types';

export default function App() {
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
  const [lastSetupError, setLastSetupError] = useState<SetupDiagnostic | null>(
    null,
  );
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    void Promise.all([
      loadAppConfig(),
      loadActualCredentials(),
      loadActualCredentialPresence(),
      loadLastSetupError(),
    ]).then(
      ([storedConfig, storedCredentials, storedPresence, storedSetupError]) => {
        setConfig(storedConfig);
        setCredentials(storedCredentials);
        setCredentialPresence(storedPresence);
        setLastSetupError(storedSetupError);
        setDraftUrl(storedConfig?.serverUrl ?? '');
        setRequestedUrl(
          storedConfig && storedCredentials ? storedConfig.serverUrl : null,
        );
        setLoading(false);
      },
    );
  }, []);

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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[ActualWrapperSetup]', message);
      await saveLastSetupError(message);
      setLastSetupError({
        message,
        timestamp: new Date().toISOString(),
      });
      Alert.alert(
        'Setup failed',
        message,
      );
    } finally {
      setSavingSetup(false);
    }
  }, [draftEncryptionPassword, draftPassword, draftUrl, savingSetup]);

  const shouldStartLoad = useCallback(
    (request: WebViewNavigation) => {
      if (!config || sameOrigin(config.serverUrl, request.url)) {
        return true;
      }

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
      setIsSettingsVisible(true);
      return;
    }

    console.info('[ActualWrapperBridge]', message.type, message.payload ?? {});
  }, []);

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

  if (loading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.centered}>
          <ActivityIndicator />
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
