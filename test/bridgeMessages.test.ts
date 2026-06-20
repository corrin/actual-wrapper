import { describe, expect, it } from 'vitest';

import { BRIDGE_MESSAGE_TYPES, parseBridgeMessage } from '../src/bridge/messages';

describe('parseBridgeMessage', () => {
  it('parses known bridge messages', () => {
    expect(
      parseBridgeMessage(
        JSON.stringify({
          type: BRIDGE_MESSAGE_TYPES.addTransactionPrefilled,
          payload: { to: '/transactions/new?notes=hello+world' },
        }),
      ),
    ).toEqual({
      type: BRIDGE_MESSAGE_TYPES.addTransactionPrefilled,
      payload: { to: '/transactions/new?notes=hello+world' },
    });
  });

  it('parses app settings requests', () => {
    expect(
      parseBridgeMessage(
        JSON.stringify({ type: BRIDGE_MESSAGE_TYPES.appSettingsRequested }),
      ),
    ).toEqual({ type: BRIDGE_MESSAGE_TYPES.appSettingsRequested });
  });

  it('ignores malformed JSON', () => {
    expect(parseBridgeMessage('{')).toBeNull();
  });

  it('ignores unknown message types', () => {
    expect(parseBridgeMessage(JSON.stringify({ type: 'unknown' }))).toBeNull();
  });
});
