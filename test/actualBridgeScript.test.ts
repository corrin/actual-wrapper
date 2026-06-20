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

type FakeClickEvent = {
  preventDefault: () => void;
  stopPropagation: () => void;
};

type FakeClickHandler = (event: FakeClickEvent) => void;

function installBridgeWithDocument({
  displayedMonth = currentMonthForTest(),
  rightSlotOccupied = false,
  pathname = '/budget',
}: {
  displayedMonth?: string;
  rightSlotOccupied?: boolean;
  pathname?: string;
} = {}) {
  const messages: unknown[] = [];
  const elements = new Map<string, FakeElement>();

  class FakeElement {
    attributes = new Map<string, string>();
    children: FakeElement[] = [];
    clickHandler: FakeClickHandler | null = null;
    id = '';
    parentElement: FakeElement | null = null;
    parentNode: { removeChild: (element: FakeElement) => void } | null = null;
    style: Record<string, string> = {};
    tagName: string;
    textContent = '';
    type = '';

    constructor(tagName: string) {
      this.tagName = tagName.toUpperCase();
    }

    get lastElementChild(): FakeElement | null {
      return this.children.at(-1) ?? null;
    }

    getAttribute(name: string) {
      return this.attributes.get(name) ?? null;
    }

    addEventListener(eventName: string, handler: FakeClickHandler) {
      if (eventName === 'click') {
        this.clickHandler = handler;
      }
    }

    appendChild(element: FakeElement) {
      element.parentElement = this;
      element.parentNode = this;
      this.children.push(element);
      indexElement(element);
    }

    closest(selector: string) {
      let element: FakeElement | null = this;
      while (element) {
        if (element.matches(selector)) {
          return element;
        }
        element = element.parentElement;
      }
      return null;
    }

    matches(selector: string) {
      if (selector === 'h1') {
        return this.tagName === 'H1';
      }

      if (selector === 'button[data-month]') {
        return (
          this.tagName === 'BUTTON' && this.attributes.has('data-month')
        );
      }

      return false;
    }

    querySelector(selector: string): FakeElement | null {
      for (const child of this.children) {
        if (child.matches(selector)) {
          return child;
        }

        const nested = child.querySelector(selector);
        if (nested) {
          return nested;
        }
      }

      return null;
    }

    querySelectorAll(selector: string): FakeElement[] {
      const matches: FakeElement[] = [];

      for (const child of this.children) {
        if (child.matches(selector)) {
          matches.push(child);
        }

        matches.push(...child.querySelectorAll(selector));
      }

      return matches;
    }

    removeChild(element: FakeElement) {
      this.children = this.children.filter(child => child !== element);
      element.parentElement = null;
      element.parentNode = null;
      unindexElement(element);
    }

    setAttribute(name: string, value: string) {
      this.attributes.set(name, value);
    }
  }

  function indexElement(element: FakeElement) {
    if (element.id) {
      elements.set(element.id, element);
    }

    element.children.forEach(indexElement);
  }

  function unindexElement(element: FakeElement) {
    if (element.id) {
      elements.delete(element.id);
    }

    element.children.forEach(unindexElement);
  }

  const body = new FakeElement('body');
  const header = new FakeElement('div');
  const leftSlot = new FakeElement('div');
  const title = new FakeElement('h1');
  const rightSlot = new FakeElement('div');
  const monthButton = new FakeElement('button');
  monthButton.setAttribute('data-month', displayedMonth);

  title.appendChild(monthButton);
  header.appendChild(leftSlot);
  header.appendChild(title);
  header.appendChild(rightSlot);
  body.appendChild(header);

  if (rightSlotOccupied) {
    const todayButton = new FakeElement('button');
    todayButton.textContent = 'Today';
    rightSlot.appendChild(todayButton);
  }

  const fakeWindow = {
    addEventListener() {},
    document: {
      body,
      createElement(tagName: string) {
        return new FakeElement(tagName);
      },
      getElementById(id: string) {
        return elements.get(id) ?? null;
      },
      querySelector(selector: string) {
        return body.querySelector(selector);
      },
      querySelectorAll(selector: string) {
        return body.querySelectorAll(selector);
      },
    },
    history: {
      pushState(_state?: unknown, _title?: string, _url?: string) {},
      replaceState(_state?: unknown, _title?: string, _url?: string) {},
    },
    location: {
      origin: 'https://budget.example.com',
      pathname,
    },
    MutationObserver: class FakeMutationObserver {
      observe() {}
    },
    ReactNativeWebView: {
      postMessage(message: string) {
        messages.push(JSON.parse(message));
      },
    },
  };

  const script = buildActualBridgeScript({ notes: 'hello world' });
  new Function('window', 'URL', script)(fakeWindow, URL);

  return { body, elements, fakeWindow, messages, rightSlot };
}

function currentMonthForTest() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
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

  it('injects an app settings button into the empty budget header right slot', () => {
    const { elements, messages, rightSlot } = installBridgeWithDocument();
    const button = elements.get('actual-wrapper-app-settings-button');

    expect(button?.textContent).toBe('⚙');
    expect(button?.parentNode).toBe(rightSlot);
    expect(button?.attributes.get('aria-label')).toBe('App Settings');
    expect(button?.style.position).toBeUndefined();
    expect(button?.style.margin).toBe('10px');
    expect(messages).toContainEqual({
      type: BRIDGE_MESSAGE_TYPES.settingsButtonInjected,
      payload: {},
    });
  });

  it('does not inject settings when Actual already uses the header right slot', () => {
    const { elements, messages, rightSlot } = installBridgeWithDocument({
      rightSlotOccupied: true,
    });

    expect(elements.get('actual-wrapper-app-settings-button')).toBeUndefined();
    expect(rightSlot.children).toHaveLength(1);
    expect(messages).not.toContainEqual({
      type: BRIDGE_MESSAGE_TYPES.settingsButtonInjected,
      payload: {},
    });
  });

  it('does not inject settings when the displayed budget month is not current', () => {
    const { elements, messages, rightSlot } = installBridgeWithDocument({
      displayedMonth: '2000-01',
    });

    expect(elements.get('actual-wrapper-app-settings-button')).toBeUndefined();
    expect(rightSlot.children).toHaveLength(0);
    expect(messages).not.toContainEqual({
      type: BRIDGE_MESSAGE_TYPES.settingsButtonInjected,
      payload: {},
    });
  });

  it('removes the settings button when leaving the budget page', async () => {
    const { elements, fakeWindow, rightSlot } = installBridgeWithDocument();

    expect(elements.get('actual-wrapper-app-settings-button')).toBeDefined();

    fakeWindow.location.pathname = '/accounts';
    fakeWindow.history.pushState(null, 'Accounts', '/accounts');
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(elements.get('actual-wrapper-app-settings-button')).toBeUndefined();
    expect(rightSlot.children).toHaveLength(0);
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
