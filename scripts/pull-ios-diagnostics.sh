#!/usr/bin/env bash
set -euo pipefail

DEVICE_ID="${IOS_DEVICE_ID:-00008140-0018254A3CA2801C}"
BUNDLE_ID="${IOS_BUNDLE_ID:-app.actualwrapper.mobile}"
DEST_ROOT="${IOS_DIAGNOSTICS_DEST_ROOT:-build/device-diagnostics}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$DEST_ROOT/$STAMP"
LOG="build/logs/device-diagnostics-$STAMP.log"
STORAGE_SOURCE="Library/Application Support/$BUNDLE_ID/RCTAsyncLocalStorage_V1"

mkdir -p "$DEST_ROOT" build/logs

xcrun devicectl device copy from \
  --device "$DEVICE_ID" \
  --domain-type appDataContainer \
  --domain-identifier "$BUNDLE_ID" \
  --source "$STORAGE_SOURCE" \
  --destination "$DEST" \
  >"$LOG" 2>&1

echo "Copied app AsyncStorage to $DEST"
echo "devicectl log: $LOG"

echo "AsyncStorage diagnostics:"
find "$DEST" -maxdepth 3 -type f -print -exec strings {} \;
