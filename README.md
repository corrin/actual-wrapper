# Actual Wrapper

An iOS and Android app shell for a user-provided Actual Budget server.

The app intentionally keeps the wrapper thin: it loads stock Actual in a
WebView, adds native permission/session affordances, and polls the user's own
Actual server for already-synced transactions so it can show local
notifications without operating a backend or triggering bank sync.

## First Commands

```sh
npm install
npm test
npm run typecheck
npm start
```

## Chunk 1 iPhone Test

Install Expo Go on the iPhone, then run:

```sh
HOME=/tmp/actual-wrapper-home npx expo start --tunnel --clear
```

Scan the QR code from Expo Go. The app should open to the setup screen, accept
an HTTPS Actual server URL, and then load the real Actual server full-screen
inside the WebView.

On Actual's current-month budget page, use the injected top-right settings icon
to view wrapper settings or reset the saved server URL.

Milestone notes live in [docs/milestones.md](docs/milestones.md).

## Current Focus

The next implementation work is structured around the highest-risk paths:

- A stock-Actual payee-location spike inside the WebView before adding any
  wrapper-native GPS code.
- Transaction detection from Actual sync messages.
- Local notification wiring that does not trigger Actual bank sync.
