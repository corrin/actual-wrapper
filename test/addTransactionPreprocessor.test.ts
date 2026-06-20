import { describe, expect, it } from 'vitest';

import { getAddTransactionPrefill } from '../src/bridge/addTransactionPreprocessor';

describe('getAddTransactionPrefill', () => {
  it('returns the current milestone prefill', () => {
    expect(getAddTransactionPrefill()).toEqual({ notes: 'hello world' });
  });
});
