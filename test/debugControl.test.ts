import { describe, expect, it } from 'vitest';

import {
  isLocalLanHost,
  normalizeDebugServerUrl,
  parseDebugCommand,
} from '../src/debug/debugControl';

describe('debug control', () => {
  it('allows localhost and private LAN websocket URLs', () => {
    expect(normalizeDebugServerUrl(' ws://192.168.1.10:35561/ws?x=1 ')).toBe(
      'ws://192.168.1.10:35561/ws',
    );
    expect(isLocalLanHost('10.0.0.5')).toBe(true);
    expect(isLocalLanHost('172.20.0.5')).toBe(true);
    expect(isLocalLanHost('localhost')).toBe(true);
  });

  it('rejects public or secure websocket URLs', () => {
    expect(() => normalizeDebugServerUrl('wss://192.168.1.10/ws')).toThrow(
      'Debug server URL must use ws://.',
    );
    expect(() => normalizeDebugServerUrl('ws://example.com/ws')).toThrow(
      'Debug server URL must point to localhost or a private LAN IP.',
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
