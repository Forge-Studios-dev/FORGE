function rejectsRawUpload(trimmed: string): boolean {
  if (/\/original\.(mp4|mov)(\?|$)/i.test(trimmed)) return true;
  if (/\.(mp4|mov)(\?|$)/i.test(trimmed) && !trimmed.includes('.m3u8')) return true;
  return false;
}

function parseMediaUrl(url: string): URL | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed;
  } catch {
    return null;
  }
}

/** HLS master only — never bare MP4 or S3 originals. */
export function isAllowedHlsUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || rejectsRawUpload(trimmed)) return false;
  const parsed = parseMediaUrl(trimmed);
  if (!parsed) return false;
  return parsed.pathname.toLowerCase().endsWith('.m3u8');
}

/** Poster / thumbnail images (Mux image API or CDN). */
export function isAllowedThumbnailUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || rejectsRawUpload(trimmed)) return false;
  const parsed = parseMediaUrl(trimmed);
  if (!parsed) return false;
  if (parsed.pathname.toLowerCase().endsWith('.m3u8')) return false;
  return /\.(jpg|jpeg|webp|png|gif)$/i.test(parsed.pathname);
}

/** WebVTT captions (Mux text tracks or CDN). */
export function isAllowedCaptionUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || rejectsRawUpload(trimmed)) return false;
  const parsed = parseMediaUrl(trimmed);
  if (!parsed) return false;
  return /\.vtt$/i.test(parsed.pathname);
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

export function sanitizeCaptionUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return isAllowedCaptionUrl(url) ? url.trim() : null;
}

export function sanitizePlaybackUrl(url: string | null | undefined): string | null {
  return sanitizeHlsUrl(url);
}
