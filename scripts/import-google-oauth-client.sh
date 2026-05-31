#!/usr/bin/env bash
# Import Google OAuth client JSON from Downloads into secrets/auth-deploy.env
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JSON_PATH="${1:-}"
ENV_FILE="${FORGE_AUTH_DEPLOY_ENV:-${ROOT}/secrets/auth-deploy.env}"

if [[ -z "$JSON_PATH" || ! -f "$JSON_PATH" ]]; then
  echo "Usage: $0 /path/to/client_secret_*.json" >&2
  exit 1
fi

export ROOT JSON_PATH ENV_FILE
python3 <<PY
import json, re, os
root = os.environ["ROOT"]
json_path = os.environ["JSON_PATH"]
env_path = os.environ["ENV_FILE"]
with open(json_path) as f:
    data = json.load(f)
web = data.get("web") or data
client_id = web["client_id"]
client_secret = web["client_secret"]
example = os.path.join(root, "secrets/auth-deploy.env.example")
text = open(env_path).read() if os.path.isfile(env_path) else open(example).read()

def upsert(key, val):
    global text
    line = f"{key}={val}"
    if re.search(rf"^{re.escape(key)}=", text, re.M):
        text = re.sub(rf"^{re.escape(key)}=.*$", line, text, flags=re.M)
    else:
        text += "\n" + line + "\n"

upsert("GOOGLE_OAUTH_ENABLED", "true")
upsert("GOOGLE_CLIENT_ID", client_id)
upsert("GOOGLE_CLIENT_SECRET", client_secret)
upsert("GOOGLE_OAUTH_CALLBACK_URL", "https://api.forgestudios.net/api/v1/auth/google/callback")
upsert("WEB_OAUTH_SUCCESS_URL", "https://forgestudios.net/auth/oauth/callback")
upsert("WEB_URL", "https://forgestudios.net")
upsert("FIREBASE_PROJECT_ID", "forge-studios-prod-61de0")
upsert("FCM_ENABLED", "false")
upsert("APP_CHECK_ENABLED", "false")
open(env_path, "w").write(text)
print(f"Updated {env_path} with Google OAuth client (redacted in log)")
PY
