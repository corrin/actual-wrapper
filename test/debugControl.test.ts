import { describe, expect, it } from 'vitest';

import {
  normalizeDebugServerUrl,
  parseDebugCommand,
} from '../src/debug/debugControl';

describe('debug control', () => {
  it('allows websocket URLs without network policy checks', () => {
    expect(normalizeDebugServerUrl(' ws://192.168.1.10:35561/ws?x=1 ')).toBe(
      'ws://192.168.1.10:35561/ws',
    );
    expect(normalizeDebugServerUrl('ws://example.com/ws')).toBe(
      'ws://example.com/ws',
    );
  });

  it('rejects secure websocket URLs', () => {
    expect(() => normalizeDebugServerUrl('wss://192.168.1.10/ws')).toThrow(
      'Debug server URL must use ws://.',
    );
  });

  it('parses explicit debug commands', () => {
    expect(
      parseDebugCommand(
        JSON.stringify({
          id: 'command-1',
          payload: { count: 3 },
          type: 'set-badge',
        }),
      ),
    ).toEqual({
      id: 'command-1',
      payload: { count: 3 },
      type: 'set-badge',
    });
  });
});
