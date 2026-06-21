import { describe, expect, it } from 'vitest';

import { buildActualAuthSeedScript } from '../src/bridge/actualAuthSeedScript';

describe('buildActualAuthSeedScript', () => {
  it('seeds Actual asyncStorage and reloads once', async () => {
    const seeded = new Map<string, unknown>();
    let reloadCount = 0;

    const fakeDb = {
      close() {},
      createObjectStore(_name: string, _options?: unknown) {},
      objectStoreNames: {
        contains(name: string) {
          return name === 'asyncStorage';
        },
      },
      transaction() {
        return {
          set oncomplete(handler: () => void) {
            setTimeout(handler, 0);
          },
          onerror: null as null | (() => void),
          objectStore() {
            return {
              put(value: unknown, key: string) {
                seeded.set(key, value);
              },
            };
          },
        };
      },
    };

    const storage = new Map<string, string>();
    const fakeWindow = {
      indexedDB: {
        open(_name: string, _version: number) {
          const request: {
            onupgradeneeded: null | ((event: unknown) => void);
            onsuccess: null | ((event: unknown) => void);
          } = {
            onupgradeneeded: null,
            onsuccess: null,
          };

          setTimeout(() => {
            request.onupgradeneeded?.({ target: { result: fakeDb } });
            request.onsuccess?.({ target: { result: fakeDb } });
          }, 0);

          return request;
        },
      },
      location: {
        reload() {
          reloadCount += 1;
        },
      },
      sessionStorage: {
        getItem(key: string) {
          return storage.get(key) ?? null;
        },
        setItem(key: string, value: string) {
          storage.set(key, value);
        },
      },
    };

    const script = buildActualAuthSeedScript({
      serverUrl: 'https://budget.example.com/',
      token: 'actual-token',
    });

    new Function('window', script)(fakeWindow);
    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(seeded).toEqual(
      new Map<string, unknown>([
        ['server-url', 'https://budget.example.com'],
        ['did-bootstrap', true],
        ['user-token', 'actual-token'],
      ]),
    );
    expect(reloadCount).toBe(1);
  });
});
