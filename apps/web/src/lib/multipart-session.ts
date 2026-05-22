export type MultipartPartEtag = { partNumber: number; etag: string };

export function multipartSessionKey(videoId: string): string {
  return `forge:multipart:${videoId}`;
}

export function loadMultipartSession(videoId: string): MultipartPartEtag[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(multipartSessionKey(videoId));
    if (!raw) return [];
    return JSON.parse(raw) as MultipartPartEtag[];
  } catch {
    return [];
  }
}

export function saveMultipartSession(videoId: string, parts: MultipartPartEtag[]): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(multipartSessionKey(videoId), JSON.stringify(parts));
}

export function clearMultipartSession(videoId: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(multipartSessionKey(videoId));
}

/** Merge local session + server checkpoint (server wins on duplicate part numbers). */
export function mergeMultipartParts(
  local: MultipartPartEtag[],
  remote: MultipartPartEtag[],
): MultipartPartEtag[] {
  const map = new Map<number, string>();
  for (const p of local) map.set(p.partNumber, p.etag);
  for (const p of remote) map.set(p.partNumber, p.etag);
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([partNumber, etag]) => ({ partNumber, etag }));
}

export function pendingPartNumbers(
  partCount: number,
  completed: MultipartPartEtag[],
): number[] {
  const done = new Set(completed.map((p) => p.partNumber));
  return Array.from({ length: partCount }, (_, i) => i + 1).filter((n) => !done.has(n));
}
