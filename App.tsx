import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
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
import { normalizeServerUrl, sameOrigin } from './src/web/urlPolicy';
import type { AppConfig } from './src/types';

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [draftUrl, setDraftUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [requestedUrl, setRequestedUrl] = useState<string | null>(null);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    void loadAppConfig().then(storedConfig => {
      setConfig(storedConfig);
      setDraftUrl(storedConfig?.serverUrl ?? '');
      setRequestedUrl(storedConfig?.serverUrl ?? null);
      setLoading(false);
    });
  }, []);

  const currentUrl = useMemo(() => {
    if (!config || !requestedUrl) {
      return null;
    }

    return requestedUrl;
  }, [config, requestedUrl]);

  const bridgeScript = useMemo(
    () => buildActualBridgeScript(getAddTransactionPrefill()),
    [],
  );

  const persistServerUrl = useCallback(async () => {
    try {
      const serverUrl = normalizeServerUrl(draftUrl);
      const nextConfig = { serverUrl };
      await saveAppConfig(nextConfig);
      setConfig(nextConfig);
      setRequestedUrl(serverUrl);
    } catch (error) {
      Alert.alert('Invalid server URL', error instanceof Error ? error.message : String(error));
    }
  }, [draftUrl]);

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
    await clearAppConfig();
    setIsSettingsVisible(false);
    setConfig(null);
    setDraftUrl('');
    setRequestedUrl(null);
  }, []);

  const setupContent = (
    <SafeAreaView style={styles.setup}>
      <StatusBar barStyle="dark-content" />
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
      <Pressable onPress={persistServerUrl} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Save server</Text>
      </Pressable>
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

  if (!config || !currentUrl) {
    return <SafeAreaProvider>{setupContent}</SafeAreaProvider>;
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <WebView
          allowsBackForwardNavigationGestures
          geolocationEnabled
          injectedJavaScriptBeforeContentLoaded={bridgeScript}
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
              <Pressable
                onPress={resetSavedServer}
                style={styles.destructiveButton}
              >
                <Text style={styles.destructiveButtonText}>
                  Reset saved server
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
  setup: {
    backgroundColor: '#f8fafc',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
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
