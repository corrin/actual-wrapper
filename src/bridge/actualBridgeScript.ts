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
  var settingsObserver = null;
  var retryCount = 0;

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

  function getAppSettingsTarget() {
    if (!window.document || !window.document.querySelectorAll) {
      return null;
    }

    if (window.location.pathname !== '/budget') {
      return null;
    }

    var monthButtons = window.document.querySelectorAll('button[data-month]');
    var monthButton = null;
    for (var i = 0; i < monthButtons.length; i += 1) {
      var candidate = monthButtons[i];
      if (!candidate.getBoundingClientRect) {
        monthButton = candidate;
        break;
      }

      var rect = candidate.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        monthButton = candidate;
        break;
      }
    }

    if (!monthButton || !monthButton.closest) {
      return null;
    }

    var displayedMonth = monthButton.getAttribute && monthButton.getAttribute('data-month');
    var now = new Date();
    var currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    if (displayedMonth !== currentMonth) {
      return null;
    }

    var title = monthButton.closest('h1');
    var header = title && title.parentElement;
    var rightSlot = header && header.lastElementChild;
    if (!rightSlot) {
      return null;
    }

    var existing = window.document.getElementById(appSettingsButtonId);
    var childCount = rightSlot.children ? rightSlot.children.length : 0;
    var hasOnlyExistingButton = existing && existing.parentNode === rightSlot && childCount === 1;
    if (childCount > 0 && !hasOnlyExistingButton) {
      return null;
    }

    return rightSlot;
  }

  function ensureAppSettingsButton() {
    try {
      if (!window.document || !window.document.body || !window.document.createElement) {
        return;
      }

      var target = getAppSettingsTarget();
      if (!target) {
        removeAppSettingsButton();
        return;
      }

      var existing = window.document.getElementById(appSettingsButtonId);
      if (existing && existing.parentNode === target) {
        return;
      }
      removeAppSettingsButton();

      var button = window.document.createElement('button');
      button.id = appSettingsButtonId;
      button.type = 'button';
      button.textContent = '⚙';
      button.setAttribute('aria-label', 'App Settings');
      button.setAttribute('title', 'App Settings');
      button.addEventListener('click', function onAppSettingsClick(event) {
        event.preventDefault();
        event.stopPropagation();
        post(config.messageTypes.appSettingsRequested, {});
      });

      button.style.background = 'transparent';
      button.style.border = 'none';
      button.style.color = '#ffffff';
      button.style.cursor = 'pointer';
      button.style.font = '20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      button.style.lineHeight = '1';
      button.style.margin = '10px';
      button.style.padding = '0';

      target.appendChild(button);
      post(config.messageTypes.settingsButtonInjected, {});
    } catch (error) {
      post(config.messageTypes.bridgeError, { message: String(error) });
    }
  }

  function afterRouteChange() {
    setTimeout(ensureAppSettingsButton, 0);
  }

  function retryAppSettingsButton() {
    if (retryCount >= 20) {
      return;
    }

    retryCount += 1;
    ensureAppSettingsButton();
    if (!window.document || !window.document.getElementById(appSettingsButtonId)) {
      setTimeout(retryAppSettingsButton, 500);
    }
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

  if (window.MutationObserver && window.document && window.document.body) {
    settingsObserver = new window.MutationObserver(afterRouteChange);
    settingsObserver.observe(window.document.body, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true
    });
  }

  post(config.messageTypes.bridgeInstalled, {});
  ensureAppSettingsButton();
  setTimeout(retryAppSettingsButton, 500);
  return true;
})();
true;
`;
}
