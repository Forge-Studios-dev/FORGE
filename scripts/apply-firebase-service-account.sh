#!/usr/bin/env bash
# Merge Firebase service account JSON into secrets/auth-deploy.env and deploy to Fly.
# Usage: bash scripts/apply-firebase-service-account.sh path/to/firebase-adminsdk-*.json
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JSON_PATH="${1:-}"
ENV_FILE="${FORGE_AUTH_DEPLOY_ENV:-${ROOT}/secrets/auth-deploy.env}"

if [[ -z "$JSON_PATH" || ! -f "$JSON_PATH" ]]; then
  echo "Usage: $0 /path/to/firebase-adminsdk-XXXX.json" >&2
  echo "If Console says 'Key creation is not allowed' — see docs/AUTH.md" >&2
  echo "An org admin must provide the JSON file, or use Workload Identity Federation." >&2
  exit 1
fi

export ROOT JSON_PATH ENV_FILE
python3 <<PY
import json, re, os
root = os.environ["ROOT"]
json_path = os.environ["JSON_PATH"]
env_path = os.environ["ENV_FILE"]
with open(json_path) as f:
    j = json.load(f)
project = j["project_id"]
email = j["client_email"]
pk = j["private_key"].replace("\n", "\\n")
example = os.path.join(root, "secrets/auth-deploy.env.example")
if os.path.isfile(env_path):
    text = open(env_path).read()
else:
    text = open(example).read()
def upsert(key, val):
    global text
    line = f'{key}={val}'
    if re.search(rf'^{re.escape(key)}=', text, re.M):
        text = re.sub(rf'^{re.escape(key)}=.*$', line, text, flags=re.M)
    else:
        text += "\n" + line + "\n"
upsert("FIREBASE_PROJECT_ID", project)
upsert("FIREBASE_CLIENT_EMAIL", email)
upsert("FIREBASE_PRIVATE_KEY", f'"{pk}"')
upsert("FCM_ENABLED", "true")
upsert("APP_CHECK_ENABLED", "false")
open(env_path, "w").write(text)
print(f"Updated {env_path} with project_id={project}")
PY

if [[ -f "${ROOT}/scripts/deploy-firebase-json-secret.sh" ]]; then
  bash "${ROOT}/scripts/deploy-firebase-json-secret.sh" "$JSON_PATH"
else
  bash "${ROOT}/scripts/deploy-auth-secrets.sh"
fi
bash "${ROOT}/scripts/check-firebase-connection.sh"
