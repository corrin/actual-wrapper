#!/usr/bin/env bash
set -euo pipefail

COMMAND="${1:-deploy}"
REMOTE_HOST="${IOS_REMOTE_HOST:-kitchenmac}"
REMOTE_REPO="${IOS_REMOTE_REPO:-\$HOME/src/actual_wrapper}"
BRANCH="${IOS_BRANCH:-codex/install-phone-dev-build}"
DEVICE_ID="${IOS_DEVICE_ID:-00008140-0018254A3CA2801C}"
BUNDLE_ID="${IOS_BUNDLE_ID:-app.actualwrapper.mobile}"
RUN_ID="${IOS_RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)}"

run_remote() {
  ssh "$REMOTE_HOST" \
    "cd \"$REMOTE_REPO\" && IOS_BRANCH=\"$BRANCH\" IOS_DEVICE_ID=\"$DEVICE_ID\" IOS_BUNDLE_ID=\"$BUNDLE_ID\" IOS_RUN_ID=\"$RUN_ID\" bash -s"
}

case "$COMMAND" in
  server)
    if command -v node >/dev/null 2>&1; then
      exec node scripts/debug-server.mjs
    fi

    if [ -x /opt/homebrew/bin/node ]; then
      exec /opt/homebrew/bin/node scripts/debug-server.mjs
    fi

    exec zsh -lc 'node scripts/debug-server.mjs'
    ;;
  server:mac)
    exec ssh "$REMOTE_HOST" \
      "cd \"$REMOTE_REPO\" && zsh -lc 'DEBUG_PUBLIC_HOST=\$(ipconfig getifaddr en0 || ipconfig getifaddr en1 || hostname) node scripts/debug-server.mjs'"
    ;;
  deploy)
    run_remote <<'REMOTE'
set -euo pipefail

RUN_DIR="build/runs/$IOS_RUN_ID"
mkdir -p "$RUN_DIR"

git fetch origin "$IOS_BRANCH" >"$RUN_DIR/git-fetch.log" 2>&1
git reset --hard "origin/$IOS_BRANCH" >"$RUN_DIR/git-reset.log" 2>&1
./build/signing-probe/unlock-build-keychain.sh >"$RUN_DIR/keychain.log" 2>&1

xcodebuild \
  -workspace ios/ActualWrapper.xcworkspace \
  -scheme ActualWrapper \
  -configuration Debug \
  -destination "id=$IOS_DEVICE_ID" \
  -destination-timeout 120 \
  build >"$RUN_DIR/build.log" 2>&1

APP_PATH="$(
  find "$HOME/Library/Developer/Xcode/DerivedData" \
    -path "*/Index.noindex/*" -prune -o \
    -path "*/Build/Products/Debug-iphoneos/ActualWrapper.app" \
    -type d \
    -print | sort | tail -1
)"
if [ -z "$APP_PATH" ]; then
  echo "Built app not found" >&2
  exit 1
fi

printf '%s\n' "$APP_PATH" >"$RUN_DIR/app-path.txt"

xcrun devicectl device install app \
  --device "$IOS_DEVICE_ID" \
  "$APP_PATH" >"$RUN_DIR/install.log" 2>&1

xcrun devicectl device info apps \
  --device "$IOS_DEVICE_ID" \
  --bundle-id "$IOS_BUNDLE_ID" >"$RUN_DIR/app-info.log" 2>&1

xcrun devicectl device process launch \
  --device "$IOS_DEVICE_ID" \
  --terminate-existing \
  "$IOS_BUNDLE_ID" >"$RUN_DIR/launch.log" 2>&1

IOS_DIAGNOSTICS_DEST_ROOT="$RUN_DIR/device-diagnostics" \
  ./scripts/pull-ios-diagnostics.sh >"$RUN_DIR/pull-diagnostics.log" 2>&1 || true

echo "Remote run artifacts: $RUN_DIR"
sed -n '/Actual Wrapper/p' "$RUN_DIR/app-info.log" || true
REMOTE
    ;;
  pull)
    run_remote <<'REMOTE'
set -euo pipefail

RUN_DIR="build/runs/$IOS_RUN_ID"
mkdir -p "$RUN_DIR"
IOS_DIAGNOSTICS_DEST_ROOT="$RUN_DIR/device-diagnostics" ./scripts/pull-ios-diagnostics.sh
echo "Remote diagnostics artifacts: $RUN_DIR"
REMOTE
    ;;
  sysdiagnose)
    run_remote <<'REMOTE'
set -euo pipefail

RUN_DIR="build/runs/$IOS_RUN_ID"
mkdir -p "$RUN_DIR/sysdiagnose"
xcrun devicectl device sysdiagnose \
  --device "$IOS_DEVICE_ID" \
  --destination "$RUN_DIR/sysdiagnose" \
  --gather-full-logs \
  >"$RUN_DIR/sysdiagnose.log" 2>&1
echo "Remote sysdiagnose artifacts: $RUN_DIR/sysdiagnose"
REMOTE
    ;;
  *)
    echo "Usage: $0 [server|server:mac|deploy|pull|sysdiagnose]" >&2
    exit 2
    ;;
esac
