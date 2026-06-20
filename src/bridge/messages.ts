export const BRIDGE_MESSAGE_TYPES = {
  addTransactionPrefilled: 'actual-wrapper:add-transaction-prefilled',
  bridgeError: 'actual-wrapper:bridge-error',
  bridgeInstalled: 'actual-wrapper:bridge-installed',
  routeIgnored: 'actual-wrapper:route-ignored',
} as const;

export type BridgeMessageType =
  (typeof BRIDGE_MESSAGE_TYPES)[keyof typeof BRIDGE_MESSAGE_TYPES];

export type BridgeMessage = {
  type: BridgeMessageType;
  payload?: unknown;
};

const MESSAGE_TYPES = new Set<string>(Object.values(BRIDGE_MESSAGE_TYPES));

export function parseBridgeMessage(raw: string): BridgeMessage | null {
  try {
    const parsed = JSON.parse(raw) as Partial<BridgeMessage>;
    if (!parsed || typeof parsed.type !== 'string') {
      return null;
    }

    if (!MESSAGE_TYPES.has(parsed.type)) {
      return null;
    }

    return parsed as BridgeMessage;
  } catch {
    return null;
  }
}
