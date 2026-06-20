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
  var appSettingsButtonId = 'actual-wrapper-app-settings-button';
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

  function removeAppSettingsButton() {
    if (!window.document || !window.document.getElementById) {
      return;
    }

    var existing = window.document.getElementById(appSettingsButtonId);
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
  }

  function ensureAppSettingsButton() {
    try {
      if (!window.document || !window.document.body || !window.document.createElement) {
        return;
      }

      if (window.location.pathname !== '/budget') {
        removeAppSettingsButton();
        return;
      }

      if (window.document.getElementById(appSettingsButtonId)) {
        return;
      }

      var button = window.document.createElement('button');
      button.id = appSettingsButtonId;
      button.type = 'button';
      button.textContent = 'App Settings';
      button.setAttribute('aria-label', 'App Settings');
      button.addEventListener('click', function onAppSettingsClick(event) {
        event.preventDefault();
        event.stopPropagation();
        post(config.messageTypes.appSettingsRequested, {});
      });

      button.style.position = 'fixed';
      button.style.right = '12px';
      button.style.bottom = '84px';
      button.style.zIndex = '2147483647';
      button.style.background = '#111827';
      button.style.color = '#ffffff';
      button.style.border = '1px solid rgba(255, 255, 255, 0.2)';
      button.style.borderRadius = '6px';
      button.style.padding = '8px 10px';
      button.style.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      button.style.boxShadow = '0 4px 10px rgba(15, 23, 42, 0.25)';

      window.document.body.appendChild(button);
      post(config.messageTypes.settingsButtonInjected, {});
    } catch (error) {
      post(config.messageTypes.bridgeError, { message: String(error) });
    }
  }

  function afterRouteChange() {
    setTimeout(ensureAppSettingsButton, 0);
  }

  window.history.pushState = function patchedPushState(state, title, url) {
    var result = originalPushState.call(window.history, state, title, withPrefill(url));
    afterRouteChange();
    return result;
  };

  window.history.replaceState = function patchedReplaceState(state, title, url) {
    var result = originalReplaceState.call(window.history, state, title, withPrefill(url));
    afterRouteChange();
    return result;
  };

  if (window.addEventListener) {
    window.addEventListener('popstate', afterRouteChange);
  }

  post(config.messageTypes.bridgeInstalled, {});
  ensureAppSettingsButton();
  return true;
})();
true;
`;
}
