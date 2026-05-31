#!/usr/bin/env bash
# Template: enable optional auth + Firebase complement on Fly/Vercel.
# Fill values from Firebase Console + Google Cloud Console before running.
set -euo pipefail

APP="${FLY_APP:-forge-studios-api}"

echo "==> Fly API secrets (edit values before uncommenting)"
cat <<'EOF'
# fly secrets set \
#   AUTH_REFRESH_COOKIE_DOMAIN='.forgestudios.net' \
#   GOOGLE_OAUTH_ENABLED='true' \
#   GOOGLE_CLIENT_ID='...apps.googleusercontent.com' \
#   GOOGLE_CLIENT_SECRET='...' \
#   GOOGLE_OAUTH_CALLBACK_URL='https://api.forgestudios.net/api/v1/auth/google/callback' \
#   WEB_OAUTH_SUCCESS_URL='https://forgestudios.net/auth/oauth/callback' \
#   FIREBASE_PROJECT_ID='your-project' \
#   FIREBASE_CLIENT_EMAIL='firebase-adminsdk-...@your-project.iam.gserviceaccount.com' \
#   FIREBASE_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n' \
#   FCM_ENABLED='true' \
#   APP_CHECK_ENABLED='false' \
#   --app forge-studios-api
EOF

echo ""
echo "==> Vercel (web) — set in project settings:"
echo "  NEXT_PUBLIC_API_URL=https://api.forgestudios.net/api/v1"
echo "  NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true  # optional if API platform/config has googleOAuth"
echo "  NEXT_PUBLIC_FIREBASE_*  # for FCM + App Check"
echo ""
echo "==> Verify after deploy"
echo "  bash scripts/verify-production-auth.sh"
echo "  curl -s https://api.forgestudios.net/api/v1/platform/config | python3 -m json.tool"
