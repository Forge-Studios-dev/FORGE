import { request } from 'node:http';
import { S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';
import { fromWebToken } from '@aws-sdk/credential-providers';
import type { AwsCredentialIdentityProvider } from '@aws-sdk/types';

export type ForgeS3Credentials = {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /**
   * When set, S3 auth uses Fly-OIDC → `sts:AssumeRoleWithWebIdentity` instead
   * of the static accessKeyId/secretAccessKey pair — see
   * docs/operations/AWS_CREDENTIAL_ROTATION.md for the one-time AWS IAM setup
   * this depends on (not something this code can do or verify by itself).
   */
  roleArn?: string;
};

const FLY_OIDC_SOCKET = '/.fly/api';
const AWS_STS_AUDIENCE = 'sts.amazonaws.com';

/** Fetches a fresh short-lived Fly OIDC JWT from the local Fly API socket — not available off Fly (local dev, CI). */
function readFlyOidcToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ aud: AWS_STS_AUDIENCE });
    const req = request(
      {
        socketPath: FLY_OIDC_SOCKET,
        path: '/v1/tokens/oidc',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`Fly OIDC token request failed: HTTP ${res.statusCode}`));
            return;
          }
          resolve(Buffer.concat(chunks).toString('utf-8').trim());
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function resolveCredentials(creds: ForgeS3Credentials): S3ClientConfig['credentials'] {
  if (creds.roleArn) {
    const roleArn = creds.roleArn;
    // fromWebToken takes a fixed token string, not a refreshing source — Fly's
    // OIDC tokens are short-lived, so a fresh one is fetched and exchanged via
    // STS on every invocation. The S3 client only calls this again once the
    // previously returned credentials' `expiration` is close, so this isn't
    // hit per-request.
    const provider: AwsCredentialIdentityProvider = async () => {
      const webIdentityToken = await readFlyOidcToken();
      const assumeRole = fromWebToken({
        roleArn,
        webIdentityToken,
        roleSessionName: `forge-${process.env.FLY_APP_NAME || 'local'}`,
        durationSeconds: 900,
      });
      return assumeRole();
    };
    return provider;
  }
  return {
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
  };
}

/** S3 client for server-side ops (worker, deletes, head). */
export function createS3Client(creds: ForgeS3Credentials): S3Client {
  return new S3Client({
    region: creds.region,
    credentials: resolveCredentials(creds),
  });
}

/**
 * Browser presigned PUT must not include flexible checksum query params (CRC32).
 * XHR cannot satisfy them and S3 returns a network/CORS-looking failure.
 */
export function createS3ClientForBrowserPresign(creds: ForgeS3Credentials): S3Client {
  const config: S3ClientConfig = {
    region: creds.region,
    credentials: resolveCredentials(creds),
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  };
  return new S3Client(config);
}
