# Milestones

## Milestone 1: iPhone Shell

Status: verified on iPhone during the original shell spike.

Acceptance result:

- App opens on an iPhone.
- User can save an HTTPS Actual server URL.
- Actual loads full-screen in the WebView.
- User can log in and view a real budget.
- No visible wrapper toolbar is present.
- The wrapper adds a top-right settings icon to Actual's current-month budget
  header for wrapper-only settings.

Run Metro:

```sh
npm start
```

If Metro is left running on port 8081:

```sh
curl http://127.0.0.1:8081/status
ps -ef | grep -E 'react-native|metro|actual_wrapper'
```

Stop only the matching Metro process for this project.

## Milestone 2: Add Transaction Bridge

Status: verified on iPhone against the real Actual server.

Acceptance result:

- Actual's own add transaction button is tapped.
- The wrapper bridge intercepts Actual's history navigation to `/transactions/new`.
- The bridge preserves router state and appends the current prefill.
- Actual's native new transaction page opens.
- Notes starts as `hello world`.

This proves preprocessing before Actual's add transaction page works. The current prefill is intentionally simple and lives behind a named seam for the next milestone.

## Pre-Milestone 3: Stock Actual Location Spike

Status: planned.

Goal:

- Prove whether stock Actual's experimental payee-location feature works inside
  the wrapper WebView on a real iPhone.
- Avoid wrapper-native GPS code if Actual's own mobile flow works.

Acceptance target:

- Enable Actual's `payeeLocations` experimental feature in the real Actual UI.
- Save a known payee location through Actual's own UI.
- Open Actual's native add transaction page from the wrapper.
- Grant WebView geolocation permission if prompted.
- Confirm the known nearby payee appears in Actual's payee autocomplete within
  Actual's built-in 500m nearby threshold.

Outcome rule:

- If the stock Actual flow works, remove the temporary `hello world` prefill
  spike and document the Actual setting instead of adding native GPS handoff.
- If it fails, record the exact failure and then plan the smallest native
  bridge needed.

## Deferred Work

Native GPS/payee prediction is deferred until the stock Actual location spike
proves it is needed.

Notifications require native-side setup state independent of the WebView session:

- Actual server URL
- password or durable token
- selected budget/file id
- encryption key material if the budget is encrypted
- sync cursor and known transaction row ids
