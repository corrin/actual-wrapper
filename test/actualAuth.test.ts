import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getActualLoginMethods,
  loginToActualWithPassword,
} from '../src/auth/actualAuth';

const storage = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    async getItem(key: string) {
      return storage.get(key) ?? null;
    },
    async removeItem(key: string) {
      storage.delete(key);
    },
    async setItem(key: string, value: string) {
      storage.set(key, value);
    },
  },
}));

function jsonResponse(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
    ...init,
  });
}

describe('Actual auth client', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    storage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('loads available login methods', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        methods: [{ active: true, displayName: 'Password', method: 'password' }],
        status: 'ok',
      }),
    );

    await expect(
      getActualLoginMethods('https://budget.example.com/'),
    ).resolves.toEqual([
      { active: true, displayName: 'Password', method: 'password' },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://budget.example.com/account/login-methods',
    );
  });

  it('logs in with password and returns the token', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          methods: [{ method: 'password' }],
          status: 'ok',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: { token: 'actual-token' },
          status: 'ok',
        }),
      );

    await expect(
      loginToActualWithPassword({
        password: ' secret ',
        serverUrl: 'https://budget.example.com/',
      }),
    ).resolves.toBe('actual-token');

    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://budget.example.com/account/login',
      {
        body: JSON.stringify({
          loginMethod: 'password',
          password: ' secret ',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );
  });

  it('blocks setup for servers without password login', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        methods: [{ method: 'openid' }],
        status: 'ok',
      }),
    );

    await expect(
      loginToActualWithPassword({
        password: 'secret',
        serverUrl: 'https://budget.example.com/',
      }),
    ).rejects.toThrow('This Actual server does not offer password login.');
  });

  it('reports login errors from Actual', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          methods: [{ method: 'password' }],
          status: 'ok',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            reason: 'invalid-password',
            status: 'error',
          },
          { status: 400 },
        ),
      );

    await expect(
      loginToActualWithPassword({
        password: 'wrong',
        serverUrl: 'https://budget.example.com/',
      }),
    ).rejects.toThrow('invalid-password');
  });

  it('reports non-JSON Actual responses with endpoint details', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('<!doctype html><title>Actual</title>', {
        headers: { 'Content-Type': 'text/html' },
        status: 200,
        statusText: 'OK',
      }),
    );

    await expect(
      getActualLoginMethods('https://budget.example.com/'),
    ).rejects.toThrow(
      'Actual server returned a non-JSON response for https://budget.example.com/account/login-methods (200 OK, text/html): <!doctype html><title>Actual</title>',
    );
  });
});
