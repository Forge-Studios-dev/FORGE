function rejectsRawUpload(trimmed: string): boolean {
  if (/\/original\.(mp4|mov)(\?|$)/i.test(trimmed)) return true;
  if (/\.(mp4|mov)(\?|$)/i.test(trimmed) && !trimmed.includes('.m3u8')) return true;
  return false;
}

/** HLS master only — never bare MP4 or S3 originals. */
export function isAllowedHlsUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || rejectsRawUpload(trimmed)) return false;
  if (trimmed.includes('stream.mux.com') && trimmed.includes('.m3u8')) return true;
  return trimmed.includes('.m3u8');
}

/** Poster / thumbnail images (Mux image API or CDN). */
export function isAllowedThumbnailUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || rejectsRawUpload(trimmed)) return false;
  if (trimmed.includes('image.mux.com')) return true;
  if (trimmed.includes('.m3u8')) return false;
  return /\.(jpg|jpeg|webp|png|gif)(\?|$)/i.test(trimmed);
}

/** @deprecated use isAllowedHlsUrl */
export function isAllowedPlaybackUrl(url: string | null | undefined): boolean {
  return isAllowedHlsUrl(url);
}

export function sanitizeHlsUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return isAllowedHlsUrl(url) ? url.trim() : null;
}

export function sanitizeThumbnailUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return isAllowedThumbnailUrl(url) ? url.trim() : null;
}

export function sanitizePlaybackUrl(url: string | null | undefined): string | null {
  return sanitizeHlsUrl(url);
}
