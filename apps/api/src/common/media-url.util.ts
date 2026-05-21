/** Build public HTTPS URLs for S3 objects (prefer CloudFront in production). */
export function buildPublicMediaUrl(
  key: string,
  opts: { cdnDomain?: string; bucket: string; region?: string },
): string {
  const normalizedKey = key.replace(/^\//, '');
  const cdn = opts.cdnDomain?.replace(/\/$/, '');
  if (cdn) return `${cdn}/${normalizedKey}`;
  const region = opts.region || 'us-east-1';
  return `https://${opts.bucket}.s3.${region}.amazonaws.com/${normalizedKey}`;
}

export function rewriteMediaUrlToCdn(
  url: string | null | undefined,
  cdnDomain: string,
): string | null {
  if (!url || !cdnDomain) return url ?? null;
  const cdn = cdnDomain.replace(/\/$/, '');
  try {
    const parsed = new URL(url);
    return `${cdn}${parsed.pathname}`;
  } catch {
    return url;
  }
}
