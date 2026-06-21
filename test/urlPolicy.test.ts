import { describe, expect, it } from 'vitest';

import {
  actualAccountUrl,
  actualSyncUrl,
  normalizeServerUrl,
  sameOrigin,
} from '../src/web/urlPolicy';

describe('normalizeServerUrl', () => {
  it('accepts HTTPS URLs and strips search/hash', () => {
    expect(normalizeServerUrl(' https://budget.example.com/app?x=1#hash ')).toBe(
      'https://budget.example.com/app',
    );
  });

  it('rejects non-HTTPS URLs', () => {
    expect(() => normalizeServerUrl('http://budget.example.com')).toThrow(
      'Version 1 only supports HTTPS Actual server URLs.',
    );
  });
});

describe('sameOrigin', () => {
  it('allows same-origin URLs', () => {
    expect(
      sameOrigin(
        'https://budget.example.com/',
        'https://budget.example.com/transactions/new',
      ),
    ).toBe(true);
  });

  it('rejects cross-origin URLs', () => {
    expect(
      sameOrigin(
        'https://budget.example.com/',
        'https://other.example.com/transactions/new',
      ),
    ).toBe(false);
  });
});

describe('Actual server endpoint URLs', () => {
  it('builds account and sync URLs at the Actual subpaths', () => {
    expect(actualAccountUrl('https://budget.example.com/', '/login')).toBe(
      'https://budget.example.com/account/login',
    );
    expect(actualSyncUrl('https://budget.example.com/', '/list-user-files')).toBe(
      'https://budget.example.com/sync/list-user-files',
    );
  });

  it('preserves subpath-hosted Actual servers', () => {
    expect(actualAccountUrl('https://example.com/actual/', '/login')).toBe(
      'https://example.com/actual/account/login',
    );
  });
});
