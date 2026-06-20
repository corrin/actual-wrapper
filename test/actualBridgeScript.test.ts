import { describe, expect, it } from 'vitest';

import { buildActualBridgeScript } from '../src/bridge/actualBridgeScript';
import { BRIDGE_MESSAGE_TYPES } from '../src/bridge/messages';

type CapturedHistoryCall = {
  state: unknown;
  title: string;
  url: string | undefined;
};

function installBridge() {
  const calls: CapturedHistoryCall[] = [];
  const messages: unknown[] = [];
  const fakeWindow = {
    history: {
      pushState(state: unknown, title: string, url?: string) {
        calls.push({ state, title, url });
      },
      replaceState(state: unknown, title: string, url?: string) {
        calls.push({ state, title, url });
      },
    },
    location: {
      origin: 'https://budget.example.com',
    },
    ReactNativeWebView: {
      postMessage(message: string) {
        messages.push(JSON.parse(message));
      },
    },
  };

  const script = buildActualBridgeScript({ notes: 'hello world' });
  new Function('window', 'URL', script)(fakeWindow, URL);

  return { calls, fakeWindow, messages };
}

function installBridgeWithDocument() {
  const messages: unknown[] = [];
  const elements = new Map<string, FakeElement>();

  class FakeElement {
    attributes = new Map<string, string>();
    clickHandler: ((event: { preventDefault: () => void; stopPropagation: () => void }) => void) | null =
      null;
    id = '';
    parentNode: { removeChild: (element: FakeElement) => void } | null = null;
    style: Record<string, string> = {};
    textContent = '';
    type = '';

    addEventListener(eventName: string, handler: FakeElement['clickHandler']) {
      if (eventName === 'click') {
        this.clickHandler = handler;
      }
    }

    setAttribute(name: string, value: string) {
      this.attributes.set(name, value);
    }
  }

  const body = {
    appendChild(element: FakeElement) {
      element.parentNode = body;
      elements.set(element.id, element);
    },
    removeChild(element: FakeElement) {
      elements.delete(element.id);
      element.parentNode = null;
    },
  };

  const fakeWindow = {
    addEventListener() {},
    document: {
      body,
      createElement() {
        return new FakeElement();
      },
      getElementById(id: string) {
        return elements.get(id) ?? null;
      },
    },
    history: {
      pushState() {},
      replaceState() {},
    },
    location: {
      origin: 'https://budget.example.com',
      pathname: '/budget',
    },
    ReactNativeWebView: {
      postMessage(message: string) {
        messages.push(JSON.parse(message));
      },
    },
  };

  const script = buildActualBridgeScript({ notes: 'hello world' });
  new Function('window', 'URL', script)(fakeWindow, URL);

  return { elements, messages };
}

describe('buildActualBridgeScript', () => {
  it('patches pushState for Actual new transaction routes', () => {
    const { calls, fakeWindow, messages } = installBridge();
    const routerState = { accountId: 'acct-1' };

    fakeWindow.history.pushState(
      routerState,
      'Add Transaction',
      '/transactions/new',
    );

    expect(calls).toEqual([
      {
        state: routerState,
        title: 'Add Transaction',
        url: '/transactions/new?notes=hello+world',
      },
    ]);
    expect(messages).toContainEqual({
      type: BRIDGE_MESSAGE_TYPES.addTransactionPrefilled,
      payload: {
        from: '/transactions/new',
        to: '/transactions/new?notes=hello+world',
      },
    });
  });

  it('preserves existing notes instead of overwriting them', () => {
    const { calls, fakeWindow } = installBridge();

    fakeWindow.history.pushState(
      null,
      'Add Transaction',
      '/transactions/new?notes=already+there',
    );

    expect(calls[0]?.url).toBe('/transactions/new?notes=already+there');
  });

  it('does not double wrap when installed more than once', () => {
    const { calls, fakeWindow, messages } = installBridge();
    const script = buildActualBridgeScript({ notes: 'ignored' });
    new Function('window', 'URL', script)(fakeWindow, URL);

    fakeWindow.history.pushState(null, 'Add Transaction', '/transactions/new');

    const installedMessages = messages.filter(
      message =>
        typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message.type === BRIDGE_MESSAGE_TYPES.bridgeInstalled,
    );

    expect(installedMessages).toHaveLength(1);
    expect(calls[0]?.url).toBe('/transactions/new?notes=hello+world');
  });

  it('does not emit telemetry for unrelated routes', () => {
    const { calls, fakeWindow, messages } = installBridge();

    fakeWindow.history.pushState(null, 'Budget', '/budget');

    expect(calls[0]?.url).toBe('/budget');
    expect(messages).toEqual([
      {
        type: BRIDGE_MESSAGE_TYPES.bridgeInstalled,
        payload: {},
      },
    ]);
  });

  it('injects an app settings button on the budget page', () => {
    const { elements, messages } = installBridgeWithDocument();
    const button = elements.get('actual-wrapper-app-settings-button');

    expect(button?.textContent).toBe('App Settings');
    expect(messages).toContainEqual({
      type: BRIDGE_MESSAGE_TYPES.settingsButtonInjected,
      payload: {},
    });
  });

  it('posts a native message when the app settings button is clicked', () => {
    const { elements, messages } = installBridgeWithDocument();
    const button = elements.get('actual-wrapper-app-settings-button');

    button?.clickHandler?.({
      preventDefault() {},
      stopPropagation() {},
    });

    expect(messages).toContainEqual({
      type: BRIDGE_MESSAGE_TYPES.appSettingsRequested,
      payload: {},
    });
  });
});
