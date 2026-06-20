import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import { loadAppConfig, saveAppConfig } from './src/storage/appConfig';
import { normalizeServerUrl, sameOrigin } from './src/web/urlPolicy';
import type { AppConfig } from './src/types';
import { registerTransactionPollTask } from './src/background/transactionPollTask';

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [draftUrl, setDraftUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [requestedUrl, setRequestedUrl] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    void loadAppConfig().then(storedConfig => {
      setConfig(storedConfig);
      setDraftUrl(storedConfig?.serverUrl ?? '');
      setRequestedUrl(storedConfig?.serverUrl ?? null);
      setLoading(false);
      void registerTransactionPollTask();
    });
  }, []);

  const currentUrl = useMemo(() => {
    if (!config || !requestedUrl) {
      return null;
    }

    return requestedUrl;
  }, [config, requestedUrl]);

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

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!config || !currentUrl) {
    return (
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
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <WebView
        allowsBackForwardNavigationGestures
        geolocationEnabled
        onShouldStartLoadWithRequest={shouldStartLoad}
        ref={webViewRef}
        source={{ uri: currentUrl }}
        style={styles.webView}
      />
    </SafeAreaView>
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
  webView: {
    flex: 1,
  },
});
