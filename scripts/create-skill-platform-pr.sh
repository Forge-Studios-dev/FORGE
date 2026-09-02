#!/usr/bin/env bash
# Create the skill-platform PR once `gh` is authenticated as a Forge-Studios-dev collaborator.
# Usage: bash scripts/create-skill-platform-pr.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! gh auth status -h github.com >/dev/null 2>&1; then
  echo "gh is not authenticated. Run: gh auth login -h github.com" >&2
  exit 1
fi

BRANCH="${1:-feature/skill-first-platform}"
BASE="${2:-main}"

EXISTING="$(gh pr list --head "$BRANCH" --base "$BASE" --json url --jq '.[0].url' 2>/dev/null || true)"
if [[ -n "$EXISTING" ]]; then
  echo "PR already exists: $EXISTING"
  exit 0
fi

gh pr create --base "$BASE" --head "$BRANCH" \
  --title "feat(platform): skill-first extensions (courses, programs, mentorship, points)" \
  --body-file docs/operations/PR_SKILL_PLATFORM.md

echo "Done. Review CI, then merge when green."
