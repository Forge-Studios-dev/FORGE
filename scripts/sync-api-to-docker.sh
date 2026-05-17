#!/usr/bin/env bash
# Hot-sync locally built API dist into running forge-api container (dev Docker workflow).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/api"
npm run build
CONTAINER="${FORGE_API_CONTAINER:-forge-api}"

files=(
  dist/common/auth/permissions.js
  dist/common/guards/permissions.guard.js
  dist/modules/users/user.mapper.js
  dist/modules/users/users.controller.js
  dist/modules/users/users.service.js
  dist/modules/users/entities/user.entity.js
  dist/modules/users/dto/request-creator.dto.js
  dist/modules/auth/auth.service.js
  dist/modules/playlists/playlists.controller.js
  dist/modules/engagement/engagement.controller.js
  dist/modules/engagement/engagement.service.js
  dist/modules/engagement/comment.mapper.js
  dist/modules/notifications/notifications.controller.js
  dist/modules/content/video.mapper.js
  dist/modules/content/videos.controller.js
  dist/modules/search/search.service.js
  dist/modules/reports/reports.controller.js
  dist/modules/feed/feed.controller.js
  dist/modules/feed/feed.service.js
  dist/modules/feed/feed.module.js
  dist/modules/streaming/streaming.controller.js
  dist/modules/streaming/stream.mapper.js
)

for f in "${files[@]}"; do
  if [[ -f "$f" ]]; then
    docker cp "$f" "$CONTAINER:/app/apps/api/$f"
    echo "synced $f"
  fi
done

docker restart "$CONTAINER"
echo "Restarted $CONTAINER — run: bash scripts/smoke-api.sh"
