#!/usr/bin/env bash
# Create PR for fix/audit-wave-4 (waves 4–8 audit remediation).
# Usage: bash scripts/pr-create-audit-wave-4.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="$(git branch --show-current)"
if [[ "$BRANCH" != "fix/audit-wave-4" ]]; then
  echo "Expected branch fix/audit-wave-4 (current: $BRANCH)" >&2
  exit 1
fi

git fetch origin main
AHEAD="$(git rev-list --count origin/main..HEAD)"
echo "Branch $BRANCH is $AHEAD commit(s) ahead of origin/main"

BODY_FILE="$ROOT/scripts/pr-bodies/audit-wave-4.md"
TITLE="feat(audit): waves 4–8 — billing, caches, mobile parity, docs"

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  gh pr create --base main --head fix/audit-wave-4 --title "$TITLE" --body-file "$BODY_FILE"
  gh pr view --web
  exit 0
fi

echo ""
echo "gh not authenticated. Open this URL to create the PR:"
echo "https://github.com/Forge-Studios-dev/FORGE/compare/main...fix/audit-wave-4"
echo ""
echo "Title: $TITLE"
echo "Body: $BODY_FILE"
