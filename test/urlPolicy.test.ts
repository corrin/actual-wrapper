import { describe, expect, it } from 'vitest';

import { normalizeServerUrl, sameOrigin } from '../src/web/urlPolicy';

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
