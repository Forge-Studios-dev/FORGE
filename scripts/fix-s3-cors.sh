#!/usr/bin/env bash
# Apply S3 CORS for browser presigned PUT uploads (requires admin/root AWS creds).
set -euo pipefail

AWS_REGION="${AWS_REGION:-eu-north-1}"
BUCKET_NAME="${BUCKET_NAME:-forge-media-prod}"

if ! command -v aws &>/dev/null; then
  echo "ERROR: AWS CLI required"
  exit 1
fi

CORS_FILE="$(mktemp)"
cat >"$CORS_FILE" <<'EOF'
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["PUT", "GET", "HEAD"],
      "AllowedOrigins": [
        "https://forgestudios.net",
        "https://www.forgestudios.net",
        "https://admin.forgestudios.net",
        "https://*.vercel.app",
        "http://localhost:3000",
        "http://localhost:3002"
      ],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
}
EOF

echo "==> Applying CORS to s3://$BUCKET_NAME ($AWS_REGION)"
aws s3api put-bucket-cors --bucket "$BUCKET_NAME" --region "$AWS_REGION" --cors-configuration "file://$CORS_FILE"
rm -f "$CORS_FILE"
aws s3api get-bucket-cors --bucket "$BUCKET_NAME" --region "$AWS_REGION"
echo "OK: CORS updated. Add Vercel preview origins manually if you test from preview URLs."
