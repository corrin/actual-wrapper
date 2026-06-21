import { describe, expect, it } from 'vitest';

import {
  DEBUG_MODE_WARNING,
  isUnsafeDebugMode,
} from '../src/debug/debugMode';

describe('debug mode safety gate', () => {
  it('uses the expected warning text', () => {
    expect(DEBUG_MODE_WARNING).toBe('DEBUG MODE - INSECURE - DANGER');
  });

  it('treats only explicit true as unsafe debug mode', () => {
    expect(isUnsafeDebugMode(true)).toBe(true);
    expect(isUnsafeDebugMode(false)).toBe(false);
    expect(isUnsafeDebugMode(undefined)).toBe(false);
    expect(isUnsafeDebugMode('true')).toBe(false);
    expect(isUnsafeDebugMode(1)).toBe(false);
  });
});
