/**
 * Shorts shelf ranking helpers (no ML) — freshness + engagement + completion,
 * with soft creator diversity.
 */

export type ShortRankSignals = {
  userId: string;
  publishedAt: Date | string | null;
  viewCount: number;
  likeCount: number;
  /**
   * Avg watched-percent (0-100) from ShortsWatchPercentService's hourly
   * precompute — YouTube's actual Shorts ranking weighs completion/rewatch
   * over raw views. Null until first computed (new Short, no watch data
   * yet) or when never recomputed (Short older than the 7-day window);
   * contributes 0 in that case rather than penalizing new content.
   */
  avgWatchPercent?: number | null;
};

export function scoreShortForFeed(item: ShortRankSignals, nowMs = Date.now()): number {
  const published =
    item.publishedAt instanceof Date
      ? item.publishedAt
      : item.publishedAt
        ? new Date(item.publishedAt)
        : null;
  const ageHours =
    published && !Number.isNaN(published.getTime())
      ? (nowMs - published.getTime()) / 3_600_000
      : 9_999;
  const freshness = ageHours <= 24 ? 50 : ageHours <= 168 ? 20 : 0;
  const views = Math.log10((item.viewCount || 0) + 1) * 10;
  const likes = Math.log10((item.likeCount || 0) + 1) * 5;
  const completion =
    item.avgWatchPercent != null ? Math.max(0, Math.min(100, item.avgWatchPercent)) * 0.5 : 0;
  return freshness + views + likes + completion;
}

/** Stable sort: higher score first; tie-break newer publishedAt. */
export function rankShortsByScore<T extends ShortRankSignals>(items: T[], nowMs = Date.now()): T[] {
  return [...items].sort((a, b) => {
    const diff = scoreShortForFeed(b, nowMs) - scoreShortForFeed(a, nowMs);
    if (diff !== 0) return diff;
    const aT = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bT = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bT - aT;
  });
}
