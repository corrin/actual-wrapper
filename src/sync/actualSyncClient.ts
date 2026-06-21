import { actualSyncUrl } from '../web/urlPolicy';
import type { ActualSyncClient } from './transactionPoller';
import type { ActualBudgetConfig } from '../types';
import { actualTimestampNow } from './actualTimestamp';
import { decodeSyncResponse, encodeSyncRequest } from './syncResponseDecoder';

export function createActualSyncClient({
  budget,
  encryptionPassword,
  serverUrl,
  token,
}: {
  budget: ActualBudgetConfig;
  encryptionPassword: string | null;
  serverUrl: string;
  token: string;
}): ActualSyncClient {
  return {
    async fetchMessagesSince(lastSyncTimestamp) {
      const since = lastSyncTimestamp ?? actualTimestampNow();
      const syncUrl = actualSyncUrl(serverUrl, '/sync');
      const requestBytes = encodeSyncRequest({ budget, since });
      const requestBuffer = new ArrayBuffer(requestBytes.byteLength);
      new Uint8Array(requestBuffer).set(requestBytes);
      const body = new Blob([requestBuffer], {
        type: 'application/actual-sync',
      });
      const response = await fetch(syncUrl, {
        body,
        headers: {
          'Content-Type': 'application/actual-sync',
          'X-ACTUAL-TOKEN': token,
        },
        method: 'POST',
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Actual sync failed for ${syncUrl} (${response.status} ${response.statusText || 'unknown status'}): ${body.replace(/\s+/g, ' ').slice(0, 120) || 'empty response'}`,
        );
      }

      const payload = new Uint8Array(await response.arrayBuffer());
      const decoded = decodeSyncResponse({
        budget,
        encryptionPassword,
        payload,
      });

      return {
        messages: decoded.messages,
        nextSyncTimestamp: since,
      };
    },
  };
}
