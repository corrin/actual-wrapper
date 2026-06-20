# Actual Budget Mobile Wrapper Implementation Plan

## Summary

Build an iOS and Android app that wraps a user's existing Actual Budget server URL with as little custom code as possible. Use Expo React Native plus `react-native-webview` for the shell, and add only targeted native features: secure setup, WebView permissions, app shortcuts/deep links, geolocation support for Actual's existing payee-location flow, and local notifications for transactions already synced into Actual.

The first implementation priority is to test the riskiest assumptions early: whether WebView geolocation works cleanly with stock Actual, and whether a lightweight device-side sync poller can detect new transaction rows without running Actual's full client API or triggering bank sync.

## Implementation Chunks

1. Project skeleton and WebView shell: Expo, TypeScript, setup screen, HTTPS URL validation, same-origin WebView navigation, external-link escape hatch.
2. WebView geolocation spike: request foreground location permission and allow stock Actual's `/transactions/new` payee-location path to use browser geolocation.
3. Sync poller feasibility spike: fetch Actual sync messages without `@actual-app/api`, decode transaction rows, baseline known rows, notify only for new rows, never trigger bank sync.
4. Notification UX and background scheduling: local notifications, best-effort background polling, foreground catch-up, notification tap routing.
5. Hardening: secure storage, reset/re-baseline, auth failure, network failure, decryption failure, changed server/budget.
6. Packaging: personal device builds first, store-readiness later, clear "for Actual Budget" branding.

## Public Interfaces And State

- `serverUrl`: HTTPS Actual server origin.
- `selectedBudget`: file id, group id, display name, encryption metadata.
- `authState`: secure token/password/header credential reference.
- `notificationState`: enabled flag, permission status, last poll result, last error.
- `syncCursor`: last successful Actual sync timestamp.
- `knownTransactionRows`: local set of transaction row ids already seen.

Native-to-WebView behavior:

- Load configured Actual URL directly.
- Navigate to `/transactions/new` for add-transaction shortcuts.
- Restrict WebView navigation to the configured Actual origin.
- Let stock Actual handle transaction entry and payee locations.
- Do not inject a custom transaction-entry UI for v1.
- Do not call Actual bank-sync APIs.

## Test Plan

Prioritize tests in this order:

1. Transaction sync-message detection: baseline, new row, update, delete, duplicate suppression.
2. WebView geolocation against stock Actual on device/simulator.
3. Actual sync protobuf decode/decrypt against local or captured Actual sync responses.
4. Background notification registration and foreground catch-up.
5. End-to-end smoke tests on physical Android and iOS devices.
6. Store-build smoke tests after personal-use flows are stable.

## Assumptions

- v1 targets iOS and Android.
- v1 uses a user-provided Actual server URL directly.
- v1 supports one server and one selected budget.
- v1 is HTTPS-only.
- No backend service is operated by us.
- Notifications are local notifications scheduled from device-side polling.
- Polling must never trigger Actual bank sync.
- Background polling is best-effort and must be supplemented by foreground catch-up.
- GPS prediction should rely on stock Actual payee locations where possible.
- Password/header-auth Actual servers are supported first; OpenID worker support is deferred unless a reliable credential path is confirmed.
