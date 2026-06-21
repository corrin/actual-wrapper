#!/usr/bin/env bash
set -euo pipefail

DEVICE_ID="${IOS_DEVICE_ID:-00008140-0018254A3CA2801C}"
BUNDLE_ID="${IOS_BUNDLE_ID:-app.actualwrapper.mobile}"
DEST_ROOT="${IOS_DIAGNOSTICS_DEST_ROOT:-build/device-diagnostics}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$DEST_ROOT/$STAMP"
LOG="build/logs/device-diagnostics-$STAMP.log"

mkdir -p "$DEST_ROOT" build/logs

xcrun devicectl device copy from \
  --device "$DEVICE_ID" \
  --domain-type appDataContainer \
  --domain-identifier "$BUNDLE_ID" \
  --source Library \
  --destination "$DEST" \
  >"$LOG" 2>&1

echo "Copied app Library to $DEST"
echo "devicectl log: $LOG"

storage="$DEST/Application Support/$BUNDLE_ID/RCTAsyncLocalStorage_V1"
if [[ ! -d "$storage" ]]; then
  storage="$DEST/Library/Application Support/$BUNDLE_ID/RCTAsyncLocalStorage_V1"
fi

if [[ ! -d "$storage" ]]; then
  echo "AsyncStorage directory not found. Available directories:"
  find "$DEST" -maxdepth 5 -type d | sort
  exit 0
fi

echo "AsyncStorage diagnostics:"
find "$storage" -maxdepth 3 -type f -print -exec strings {} \;
