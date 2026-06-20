# Milestones

## Milestone 1: iPhone Shell

Status: verified on iPhone with Expo Go SDK 54.

Acceptance result:

- App opens from the Expo tunnel in WSL.
- User can save an HTTPS Actual server URL.
- Actual loads full-screen in the WebView.
- User can log in and view a real budget.
- No visible wrapper toolbar is present.
- The wrapper adds an `App Settings` button to Actual's budget page for
  wrapper-only settings.

Run command:

```sh
HOME=/tmp/actual-wrapper-home npx expo start --tunnel --clear
```

If Metro is left running on port 8081:

```sh
curl http://127.0.0.1:8081/status
ps -ef | grep -E 'expo|ngrok|actual_wrapper'
```

Stop only the matching Expo/ngrok process for this project.

## Milestone 2: Add Transaction Bridge

Status: verified on iPhone against the real Actual server.

Acceptance result:

- Actual's own add transaction button is tapped.
- The wrapper bridge intercepts Actual's history navigation to `/transactions/new`.
- The bridge preserves router state and appends the current prefill.
- Actual's native new transaction page opens.
- Notes starts as `hello world`.

This proves preprocessing before Actual's add transaction page works. The current prefill is intentionally simple and lives behind a named seam for the next milestone.

## Deferred Work

GPS/payee prediction starts after Milestone 2 cleanup.

Notifications require native-side setup state independent of the WebView session:

- Actual server URL
- password or durable token
- selected budget/file id
- encryption key material if the budget is encrypted
- sync cursor and known transaction row ids
