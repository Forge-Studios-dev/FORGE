const preloaded = new Set<string>();

/** Prefetch HLS master manifests only (not segments) for smoother feed/watch transitions. */
export function preloadHlsManifests(
  urls: (string | null | undefined)[],
  max = 3,
): void {
  if (typeof window === 'undefined') return;

  const manifests = urls
    .filter((u): u is string => typeof u === 'string' && u.includes('.m3u8'))
    .slice(0, max);

  for (const url of manifests) {
    if (preloaded.has(url)) continue;
    preloaded.add(url);
    void fetch(url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'force-cache',
    }).catch(() => {
      preloaded.delete(url);
    });
  }
}
