/** Detect YouTube/Vimeo URLs suitable for iframe embed. */
export function isVideoEmbedUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'youtu.be' ||
      host === 'vimeo.com' ||
      host === 'player.vimeo.com'
    );
  } catch {
    return false;
  }
}

/** Convert a watch/share URL to an embeddable iframe src, or null if unsupported. */
export function toVideoEmbedSrc(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = parsed.pathname.slice(1).split('/')[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = parsed.searchParams.get('v') ?? parsed.pathname.split('/').pop();
      if (id && id !== 'watch' && id !== 'embed') {
        return `https://www.youtube.com/embed/${id}`;
      }
      if (parsed.pathname.startsWith('/embed/')) {
        return parsed.toString();
      }
    }

    if (host === 'vimeo.com') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }

    if (host === 'player.vimeo.com') {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}

export function isImageMediaUrl(url: string): boolean {
  return !isVideoEmbedUrl(url);
}
