#!/usr/bin/env bash
# FORGE AWS setup: S3 bucket, CORS, IAM user, CloudFront (OAC).
# Requires: AWS CLI v2, credentials with IAM + S3 + CloudFront permissions.
#
# Usage:
#   aws configure   # or export AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
#   ./scripts/setup-aws-forge.sh
#
# Optional env overrides:
#   AWS_REGION=eu-north-1 BUCKET_NAME=forge-media-prod IAM_USER=forge-api-media

set -euo pipefail

AWS_REGION="${AWS_REGION:-eu-north-1}"
BUCKET_NAME="${BUCKET_NAME:-forge-media-prod}"
IAM_USER="${IAM_USER:-forge-api-media}"
IAM_POLICY_NAME="${IAM_POLICY_NAME:-ForgeMediaS3Policy}"
OAC_NAME="${OAC_NAME:-forge-media-prod-oac}"
OUTPUT_FILE="${OUTPUT_FILE:-.aws-forge-output.env}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> FORGE AWS setup"
echo "    Region:  $AWS_REGION"
echo "    Bucket:  $BUCKET_NAME"
echo "    IAM user: $IAM_USER"
echo ""

if ! command -v aws &>/dev/null; then
  echo "ERROR: AWS CLI not found. Install: brew install awscli"
  exit 1
fi

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
echo "==> AWS account: $ACCOUNT_ID"
echo ""

# --- S3 bucket ---
if aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
  echo "==> Bucket $BUCKET_NAME already exists"
else
  echo "==> Creating S3 bucket $BUCKET_NAME"
  if [ "$AWS_REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET_NAME" --region "$AWS_REGION"
  else
    aws s3api create-bucket \
      --bucket "$BUCKET_NAME" \
      --region "$AWS_REGION" \
      --create-bucket-configuration "LocationConstraint=$AWS_REGION"
  fi
fi

echo "==> Block all public access"
aws s3api put-public-access-block \
  --bucket "$BUCKET_NAME" \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

echo "==> CORS"
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
        "http://localhost:3000",
        "http://localhost:3002"
      ],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
}
EOF
aws s3api put-bucket-cors --bucket "$BUCKET_NAME" --cors-configuration "file://$CORS_FILE"
rm -f "$CORS_FILE"

# --- IAM ---
POLICY_DOC="$(mktemp)"
cat >"$POLICY_DOC" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ForgeMediaBucket",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:HeadObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::${BUCKET_NAME}",
        "arn:aws:s3:::${BUCKET_NAME}/*"
      ]
    }
  ]
}
EOF

POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${IAM_POLICY_NAME}"
if aws iam get-policy --policy-arn "$POLICY_ARN" &>/dev/null; then
  echo "==> IAM policy $IAM_POLICY_NAME exists — updating default version"
  VERSIONS="$(aws iam list-policy-versions --policy-arn "$POLICY_ARN" --query 'Versions[?!IsDefaultVersion].VersionId' --output text)"
  for v in $VERSIONS; do
    aws iam delete-policy-version --policy-arn "$POLICY_ARN" --version-id "$v" 2>/dev/null || true
  done
  aws iam create-policy-version --policy-arn "$POLICY_ARN" --policy-document "file://$POLICY_DOC" --set-as-default
else
  echo "==> Creating IAM policy $IAM_POLICY_NAME"
  POLICY_ARN="$(aws iam create-policy --policy-name "$IAM_POLICY_NAME" --policy-document "file://$POLICY_DOC" --query Policy.Arn --output text)"
fi
rm -f "$POLICY_DOC"

if ! aws iam get-user --user-name "$IAM_USER" &>/dev/null; then
  echo "==> Creating IAM user $IAM_USER"
  aws iam create-user --user-name "$IAM_USER"
else
  echo "==> IAM user $IAM_USER already exists"
fi

aws iam attach-user-policy --user-name "$IAM_USER" --policy-arn "$POLICY_ARN" 2>/dev/null || true

echo "==> Creating new access key for $IAM_USER (deactivate old keys in console if rotating)"
read -r ACCESS_KEY_ID SECRET_ACCESS_KEY < <(
  aws iam create-access-key --user-name "$IAM_USER" \
    --query 'AccessKey.[AccessKeyId,SecretAccessKey]' --output text
)

# --- CloudFront OAC + distribution ---
BUCKET_DOMAIN="${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com"

echo "==> CloudFront Origin Access Control"
OAC_ID="$(aws cloudfront list-origin-access-controls --query "OriginAccessControlList.Items[?Name=='${OAC_NAME}'].Id" --output text 2>/dev/null || true)"
if [ -z "$OAC_ID" ] || [ "$OAC_ID" = "None" ]; then
  OAC_ID="$(aws cloudfront create-origin-access-control --origin-access-control-config "{
    \"Name\": \"${OAC_NAME}\",
    \"Description\": \"FORGE media bucket OAC\",
    \"SigningProtocol\": \"sigv4\",
    \"SigningBehavior\": \"always\",
    \"OriginAccessControlOriginType\": \"s3\"
  }" --query 'OriginAccessControl.Id' --output text)"
fi
echo "    OAC ID: $OAC_ID"

EXISTING_DIST="$(aws cloudfront list-distributions --query "DistributionList.Items[?Origins.Items[?DomainName=='${BUCKET_DOMAIN}']].Id" --output text 2>/dev/null || true)"
if [ -n "$EXISTING_DIST" ] && [ "$EXISTING_DIST" != "None" ]; then
  DIST_ID="$EXISTING_DIST"
  echo "==> CloudFront distribution already exists: $DIST_ID"
else
  echo "==> Creating CloudFront distribution (may take 10–15 min to deploy)"
  CALLER_REF="forge-$(date +%s)"
  DIST_CONFIG="$(mktemp)"
  cat >"$DIST_CONFIG" <<EOF
{
  "CallerReference": "${CALLER_REF}",
  "Comment": "FORGE media CDN",
  "Enabled": true,
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-${BUCKET_NAME}",
        "DomainName": "${BUCKET_DOMAIN}",
        "OriginAccessControlId": "${OAC_ID}",
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-${BUCKET_NAME}",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 3,
      "Items": ["GET", "HEAD", "OPTIONS"],
      "CachedMethods": {
        "Quantity": 2,
        "Items": ["GET", "HEAD"]
      }
    },
    "Compress": true,
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": { "Forward": "none" }
    },
    "MinTTL": 0,
    "DefaultTTL": 86400,
    "MaxTTL": 31536000
  },
  "DefaultRootObject": "",
  "PriceClass": "PriceClass_100"
}
EOF
  DIST_ID="$(aws cloudfront create-distribution --distribution-config "file://$DIST_CONFIG" --query 'Distribution.Id' --output text)"
  rm -f "$DIST_CONFIG"
fi

DIST_DOMAIN="$(aws cloudfront get-distribution --id "$DIST_ID" --query 'Distribution.DomainName' --output text)"
DIST_ARN="arn:aws:cloudfront::${ACCOUNT_ID}:distribution/${DIST_ID}"
CLOUDFRONT_URL="https://${DIST_DOMAIN}"

echo "==> S3 bucket policy for CloudFront OAC"
BUCKET_POLICY="$(mktemp)"
cat >"$BUCKET_POLICY" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${BUCKET_NAME}/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "${DIST_ARN}"
        }
      }
    }
  ]
}
EOF
aws s3api put-bucket-policy --bucket "$BUCKET_NAME" --policy "file://$BUCKET_POLICY"
rm -f "$BUCKET_POLICY"

# --- Output ---
cat >"$OUTPUT_FILE" <<EOF
# Generated by scripts/setup-aws-forge.sh — DO NOT COMMIT
AWS_REGION=${AWS_REGION}
AWS_ACCESS_KEY_ID=${ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${SECRET_ACCESS_KEY}
S3_BUCKET_NAME=${BUCKET_NAME}
CLOUDFRONT_DOMAIN=${CLOUDFRONT_URL}
# CloudFront distribution ID (deploying): ${DIST_ID}
EOF

echo ""
echo "=============================================="
echo "  FORGE AWS setup complete"
echo "=============================================="
echo ""
echo "  S3 bucket:     $BUCKET_NAME ($AWS_REGION)"
echo "  IAM user:      $IAM_USER"
echo "  CloudFront:    $CLOUDFRONT_URL"
echo "  Distribution:  $DIST_ID (wait until Status=Deployed)"
echo ""
echo "  Secrets written to: $OUTPUT_FILE"
echo ""
echo "  Next steps:"
echo "  1. cp $OUTPUT_FILE apps/api/.env   # merge with existing .env"
echo "  2. fly secrets set ... --app forge-studios-api"
echo "  3. Test creator upload on forgestudios.net"
echo ""
echo "  SECURITY: rotate/delete this file after copying secrets."
echo "=============================================="
