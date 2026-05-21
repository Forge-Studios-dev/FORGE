import { S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';

export type ForgeS3Credentials = {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
};

/** S3 client for server-side ops (worker, deletes, head). */
export function createS3Client(creds: ForgeS3Credentials): S3Client {
  return new S3Client({
    region: creds.region,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
    },
  });
}

/**
 * Browser presigned PUT must not include flexible checksum query params (CRC32).
 * XHR cannot satisfy them and S3 returns a network/CORS-looking failure.
 */
export function createS3ClientForBrowserPresign(creds: ForgeS3Credentials): S3Client {
  const config: S3ClientConfig = {
    region: creds.region,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  };
  return new S3Client(config);
}
