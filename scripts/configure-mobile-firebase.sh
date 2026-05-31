#!/usr/bin/env bash
# Generate apps/mobile/lib/firebase_options.dart via FlutterFire CLI.
# Requires: Flutter SDK, Firebase project access, logged-in Firebase CLI.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}/apps/mobile"

if ! command -v flutter >/dev/null 2>&1; then
  echo "FAIL: flutter not on PATH" >&2
  exit 1
fi

echo "==> Install FlutterFire CLI (if needed)"
dart pub global activate flutterfire_cli 2>/dev/null || true
export PATH="${PATH}:${HOME}/.pub-cache/bin"

if ! command -v flutterfire >/dev/null 2>&1; then
  echo "FAIL: flutterfire not on PATH after activate" >&2
  exit 1
fi

echo "==> Configure Firebase for FORGE mobile (FCM + App Check — not Firebase Auth)"
PROJECT="${FIREBASE_PROJECT_ID:-forge-studios-prod-61de0}"
flutterfire configure \
  --project="$PROJECT" \
  --out=lib/firebase_options.dart \
  --platforms=android,ios \
  --android-package-name=com.forgestudios.app \
  --ios-bundle-id=com.forgestudios.app \
  --yes

echo ""
echo "OK: firebase_options.dart updated."
echo "Next: set Fly FIREBASE_* + FCM_ENABLED=true; rebuild mobile release."
