import { describe, expect, it } from 'vitest';

import { appendAddTransactionPrefill } from '../src/bridge/addTransactionPrefill';

const baseUrl = 'https://budget.example.com/';

describe('appendAddTransactionPrefill', () => {
  it('adds hello world notes to the new transaction route', () => {
    expect(
      appendAddTransactionPrefill('/transactions/new', { notes: 'hello world' }, baseUrl),
    ).toBe('/transactions/new?notes=hello+world');
  });

  it('preserves existing query params', () => {
    expect(
      appendAddTransactionPrefill(
        '/transactions/new?account=Checking',
        { notes: 'hello world' },
        baseUrl,
      ),
    ).toBe('/transactions/new?account=Checking&notes=hello+world');
  });

  it('does not overwrite existing notes', () => {
    expect(
      appendAddTransactionPrefill(
        '/transactions/new?notes=already+there',
        { notes: 'hello world' },
        baseUrl,
      ),
    ).toBe('/transactions/new?notes=already+there');
  });

  it('leaves other Actual routes unchanged', () => {
    expect(
      appendAddTransactionPrefill('/accounts', { notes: 'hello world' }, baseUrl),
    ).toBe('/accounts');
  });

  it('leaves cross-origin URLs unchanged', () => {
    expect(
      appendAddTransactionPrefill(
        'https://example.net/transactions/new',
        { notes: 'hello world' },
        baseUrl,
      ),
    ).toBe('https://example.net/transactions/new');
  });
});
