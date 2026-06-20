import type { AddTransactionPrefill } from './addTransactionPrefill';
import { BRIDGE_MESSAGE_TYPES } from './messages';

export function buildActualBridgeScript(prefill: AddTransactionPrefill): string {
  const bridgeConfig = JSON.stringify({
    messageTypes: BRIDGE_MESSAGE_TYPES,
    prefill,
  });

  return `
(function installActualWrapperBridge() {
  if (window.__actualWrapperBridgeInstalled) {
    return true;
  }

  window.__actualWrapperBridgeInstalled = true;

  var config = ${bridgeConfig};
  var originalPushState = window.history.pushState;
  var originalReplaceState = window.history.replaceState;

  function post(type, payload) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, payload: payload || {} }));
      }
    } catch (_error) {
    }
  }

  function withPrefill(candidateUrl) {
    if (typeof candidateUrl !== 'string') {
      return candidateUrl;
    }

    try {
      var url = new URL(candidateUrl, window.location.origin);
      if (url.origin !== window.location.origin || url.pathname !== '/transactions/new') {
        post(config.messageTypes.routeIgnored, { url: candidateUrl });
        return candidateUrl;
      }

      if (config.prefill.notes && !url.searchParams.has('notes')) {
        url.searchParams.set('notes', config.prefill.notes);
      }

      var patchedUrl = url.pathname + url.search + url.hash;
      post(config.messageTypes.addTransactionPrefilled, {
        from: candidateUrl,
        to: patchedUrl
      });
      return patchedUrl;
    } catch (error) {
      post(config.messageTypes.bridgeError, { message: String(error) });
      return candidateUrl;
    }
  }

  window.history.pushState = function patchedPushState(state, title, url) {
    return originalPushState.call(window.history, state, title, withPrefill(url));
  };

  window.history.replaceState = function patchedReplaceState(state, title, url) {
    return originalReplaceState.call(window.history, state, title, withPrefill(url));
  };

  post(config.messageTypes.bridgeInstalled, {});
  return true;
})();
true;
`;
}
