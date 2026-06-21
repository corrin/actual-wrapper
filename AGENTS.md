# Repository Guidelines

## Project Intent

Actual Wrapper is a thin iOS and Android shell around a user-provided Actual
Budget server. Keep the wrapper small: load stock Actual in the WebView and add
only native capabilities that cannot be delivered well by Actual's PWA.

Before adding wrapper-native behavior, check whether stock Actual already has a
suitable implementation. If the answer is unclear, inspect the local Actual
checkout at `../downloaded/actual/`. When Actual gains equivalent functionality,
prefer deleting the wrapper code over maintaining parallel behavior here.

The first wrapper-native feature is local transaction notifications. Native GPS
or location prediction is deferred unless Actual's own payee-location flow proves
insufficient.

## Architecture Rules

- Do not add a backend service. Budget, transaction, credential, and location
  data should stay on the device except for calls to the user's own Actual
  server.
- Do not trigger Actual bank sync from the wrapper. Notification polling should
  only detect transactions that have already arrived in Actual.
- Strictly avoid fallback semantics in this codebase. If a requirement cannot be
  met exactly, fail visibly instead of substituting weaker behavior.
- Prefer Actual's own screens and routes over custom native UI. Use bridge code
  only for wrapper settings, setup affordances, native permissions, and narrow
  handoffs that Actual cannot do itself.
- Keep WebView navigation restricted to the configured Actual origin; external
  links should leave the WebView.
- Store credentials and secrets only through the existing secure-storage path.

## Repo Shape

- `App.tsx` is the Expo app entry and owns setup, WebView loading, settings, and
  top-level state wiring.
- `src/bridge/` contains JavaScript injected into Actual. Keep it defensive and
  covered by tests because it depends on Actual's DOM and route behavior.
- `src/auth/`, `src/storage/`, `src/sync/`, and `src/background/` contain native
  side support for Actual login, local persistence, sync-message polling, and
  notification scheduling.
- `src/web/urlPolicy.ts` owns URL normalization and origin checks.
- `test/` contains Vitest coverage for pure TypeScript behavior and generated
  bridge scripts.

## Development Workflow

- Use `npm test` for the unit test suite.
- Use `npm run typecheck` before handing off code changes.
- Use `npm start` for Expo development; the iPhone tunnel workflow documented in
  `README.md` and `docs/milestones.md` is:
  `HOME=/tmp/actual-wrapper-home npx expo start --tunnel --clear`.
- For docs-only changes, automated tests are optional; read the changed document
  back for consistency.

## Coding Practices

- Follow the existing TypeScript style: strict types, small modules, and explicit
  error messages for user-visible failures.
- Prefer pure, tested helpers for parsing, URL policy, sync decoding, and bridge
  message handling.
- Treat injected WebView JavaScript as fragile integration code. Keep it minimal,
  idempotent, and tolerant of missing DOM nodes or Actual UI changes.
- Avoid broad refactors while adding a feature. Keep changes scoped to the
  missing native capability being implemented.
- Preserve unrelated dirty worktree changes. Do not reset, restore, or rewrite
  files you did not need to touch.

## Product Checks

When proposing or implementing a feature, answer these questions in the code,
docs, or PR summary as appropriate:

- Can stock Actual already do this?
- If not, is the smallest useful wrapper feature native-only or bridge-only?
- What data leaves the device, and is it limited to the user's Actual server?
- What condition lets us delete this wrapper functionality later?
