#!/bin/sh
set -e
cd /app
for candidate in \
  apps/api/dist/main.js \
  apps/api/dist/apps/api/src/main.js; do
  if [ -f "$candidate" ]; then
    exec node "$candidate"
  fi
done
echo "ERROR: API entrypoint not found under apps/api/dist" >&2
find apps/api/dist -name 'main.js' 2>/dev/null || true
exit 1
