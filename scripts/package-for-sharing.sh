#!/usr/bin/env bash
# Build a small shareable ZIP without bloating the working tree (unless --strip-local).
# Keeps source, configs, .env*, lockfiles, docs, CI. Strips deps/build/cache.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

STRIP_LOCAL=0
INCLUDE_GIT=1
OUTPUT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --strip-local) STRIP_LOCAL=1 ;;
    --no-git) INCLUDE_GIT=0 ;;
    -o|--output)
      OUTPUT="${2:?Missing path after $1}"
      shift
      ;;
    --output=*)
      OUTPUT="${1#*=}"
      ;;
    -h|--help)
      cat <<'EOF'
Usage: bash scripts/package-for-sharing.sh [options]

Creates FORGE-shareable-YYYYMMDD.zip (default: parent of repo) from a clean
rsync copy — node_modules, .next, dist, and other generated dirs are excluded.

Options:
  --strip-local   Also delete regenerable dirs from this repo (frees ~1GB+ disk)
  --no-git        Omit .git from the archive (~14MB smaller)
  -o PATH         Output .zip path
  -h, --help      Show this help

After extract on another machine: npm install && npm run build:all (optional)
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
  shift
done

if [[ -z "$OUTPUT" ]]; then
  OUTPUT="$(dirname "$ROOT")/FORGE-shareable-$(date +%Y%m%d).zip"
fi

STAGING="$(mktemp -d "${TMPDIR:-/tmp}/forge-share-XXXXXX")"
trap 'rm -rf "$STAGING"' EXIT

RSYNC_EXCLUDES=(
  --exclude 'node_modules'
  --exclude '.next'
  --exclude 'dist'
  --exclude 'build'
  --exclude '.turbo'
  --exclude '.cache'
  --exclude 'coverage'
  --exclude 'out'
  --exclude 'temp'
  --exclude 'tmp'
  --exclude '.dart_tool'
  --exclude '.gradle'
  --exclude 'Pods'
  --exclude '.symlinks'
  --exclude 'postgres_data'
  --exclude 'redis_data'
  --exclude 'test-results'
  --exclude 'playwright-report'
  --exclude 'blob-report'
  --exclude '*.tsbuildinfo'
  --exclude '.DS_Store'
  --exclude '*.log'
  --exclude '*.zip'
)

if [[ "$INCLUDE_GIT" -eq 0 ]]; then
  RSYNC_EXCLUDES+=(--exclude '.git')
fi

echo "→ Staging clean copy at $STAGING"
rsync -a "${RSYNC_EXCLUDES[@]}" "$ROOT/" "$STAGING/FORGE/"

BEFORE_KB=$(du -sk "$ROOT" 2>/dev/null | cut -f1 || echo 0)
STAGING_KB=$(du -sk "$STAGING" | cut -f1)
STAGING_H=$(du -sh "$STAGING" | cut -f1)

rm -f "$OUTPUT"
echo "→ Writing $OUTPUT"
(
  cd "$STAGING"
  zip -r -q "$OUTPUT" FORGE
)

ZIP_H=$(du -sh "$OUTPUT" | cut -f1)
echo ""
echo "Done."
echo "  Workspace (unchanged unless --strip-local): $(du -sh "$ROOT" | cut -f1)"
echo "  Staged payload:                          $STAGING_H"
echo "  ZIP:                                       $OUTPUT ($ZIP_H)"

if [[ "$STRIP_LOCAL" -eq 1 ]]; then
  echo "→ --strip-local: removing regenerable dirs from $ROOT"
  strip_paths=(
    node_modules
    apps/api/node_modules
    apps/web/.next
    apps/admin/.next
    apps/api/dist
    packages/shared-types/dist
    packages/design-system/dist
    apps/mobile/.dart_tool
    apps/mobile/build
  )
  for p in "${strip_paths[@]}"; do
    if [[ -e "$ROOT/$p" ]]; then
      chmod -R u+w "$ROOT/$p" 2>/dev/null || true
      rm -rf "$ROOT/$p"
    fi
  done
  find "$ROOT" -type d \( -name .turbo -o -name test-results -o -name playwright-report -o -name blob-report \) \
    -not -path '*/node_modules/*' -exec rm -rf {} + 2>/dev/null || true
  find "$ROOT" \( -name '*.tsbuildinfo' -o -name '.DS_Store' \) -not -path '*/node_modules/*' -delete 2>/dev/null || true
  AFTER_H=$(du -sh "$ROOT" | cut -f1)
  echo "  Workspace after strip:                     $AFTER_H"
fi
