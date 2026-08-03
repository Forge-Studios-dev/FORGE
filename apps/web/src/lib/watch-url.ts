/** YouTube-style `t=` query helpers (`t=90`, `t=1m30s`, `t=1h2m3s`). */

export function formatTimeQueryParam(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s < 60) return String(s);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h${m}m${sec}s`;
  if (sec === 0) return `${m}m`;
  return `${m}m${sec}s`;
}

export function parseTimeQueryParam(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const n = Number.parseInt(trimmed, 10);
    return Number.isFinite(n) ? n : null;
  }
  const match = trimmed.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (!match || (!match[1] && !match[2] && !match[3])) return null;
  const h = Number.parseInt(match[1] ?? '0', 10);
  const m = Number.parseInt(match[2] ?? '0', 10);
  const s = Number.parseInt(match[3] ?? '0', 10);
  return h * 3600 + m * 60 + s;
}

export function buildWatchShareUrl(opts: {
  videoId: string;
  origin?: string;
  seconds?: number | null;
  listId?: string | null;
}): string {
  const origin =
    opts.origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const url = new URL(`/watch/${opts.videoId}`, origin || 'https://forge.local');
  if (opts.listId) url.searchParams.set('list', opts.listId);
  if (opts.seconds != null && opts.seconds > 0) {
    url.searchParams.set('t', formatTimeQueryParam(opts.seconds));
  }
  return url.toString();
}
