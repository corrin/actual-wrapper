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
HOME=/tmp/actual-wrapper-home npx expo start --host lan
```

Scan the QR code from Expo Go. The app should open to the setup screen, accept
an HTTPS Actual server URL, and then load the real Actual server inside the
WebView.

If the iPhone cannot reach the LAN URL, restart with Expo tunnel mode:

```sh
HOME=/tmp/actual-wrapper-home npx expo start --tunnel
```

## Current Focus

The first implementation is structured around the highest-risk paths:

- WebView geolocation for Actual's existing payee-location feature.
- Transaction detection from Actual sync messages.
- Local notification wiring that does not trigger Actual bank sync.
