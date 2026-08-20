#!/usr/bin/env bash
# Set Stripe billing secrets on Fly (never commit real values).
#
# Usage:
#   export STRIPE_SECRET_KEY='sk_live_...'
#   export STRIPE_WEBHOOK_SECRET='whsec_...'
#   bash scripts/set-stripe-secrets-fly.sh
#
# Optional:
#   STRIPE_CONNECT_REFRESH_URL='https://forgestudios.net/studio/memberships'
#   STRIPE_PLATFORM_FEE_PERCENT=10
#   FLY_APP=forge-studios-staging bash scripts/set-stripe-secrets-fly.sh
#
# See: docs/operations/STRIPE_PRODUCTION_ENABLEMENT.md
set -euo pipefail

: "${STRIPE_SECRET_KEY:?Set STRIPE_SECRET_KEY}"
: "${STRIPE_WEBHOOK_SECRET:?Set STRIPE_WEBHOOK_SECRET}"

APP="${FLY_APP:-forge-studios-api}"
REFRESH_URL="${STRIPE_CONNECT_REFRESH_URL:-https://forgestudios.net/studio/memberships}"
FEE_PERCENT="${STRIPE_PLATFORM_FEE_PERCENT:-10}"

echo "==> Setting Stripe billing secrets on ${APP}"

# `fly secrets import` over stdin (not `secrets set KEY=value` CLI args) —
# args would leave live keys in shell history and briefly visible via `ps aux`,
# same reasoning as sync-fly-worker-secrets.sh.
SECRETS_FILE="$(mktemp)"
trap 'rm -f "$SECRETS_FILE"' EXIT
cat > "$SECRETS_FILE" <<EOF
BILLING_PROVIDER=stripe
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
STRIPE_CONNECT_REFRESH_URL=${REFRESH_URL}
STRIPE_PLATFORM_FEE_PERCENT=${FEE_PERCENT}
EOF

fly secrets import --app "${APP}" < "$SECRETS_FILE"

echo ""
echo "OK: Stripe secrets set on ${APP}"
echo "Next:"
echo "  1. Stripe Dashboard → Webhooks → https://api.forgestudios.net/api/v1/billing/webhook"
echo "  2. Vercel: NEXT_PUBLIC_BILLING_ENABLED=true on production web"
echo "  3. Run checklist: docs/operations/STRIPE_PRODUCTION_ENABLEMENT.md §6"
