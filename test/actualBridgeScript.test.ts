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
});
