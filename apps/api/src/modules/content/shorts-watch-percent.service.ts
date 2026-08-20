import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PublishStatus, Video, VideoStatus, VideoType } from './entities/video.entity';

/**
 * Closes a gap flagged in the 2026-08-09 platform audit: Shorts-feed ranking
 * (shorts-rank.util.ts) used only freshness + view/like counts, not
 * completion/rewatch — the signal YouTube's actual Shorts algorithm weighs
 * most heavily. The audit deferred this pending an "eng lead" call on
 * precompute cadence/storage, since the completion rate (avg watched-percent
 * over watch_history) is too expensive to aggregate live on every feed
 * request. Decision made here, following this codebase's own established
 * pattern for exactly this kind of tradeoff (ScheduledPublishService,
 * AnalyticsRetentionService):
 *
 * - Cache avg_watch_percent + watch_percent_updated_at directly on Video.
 * - Recompute hourly (see ShortsWatchPercentScheduler) — frequent enough
 *   that ranking reflects same-day engagement, far cheaper than per-request.
 *   scoreShortForFeed's own freshness bucket only changes resolution at
 *   24h/168h anyway, so hourly staleness on the completion signal doesn't
 *   bottleneck ranking quality.
 * - Only recompute Shorts published in the last 7 days — scoreShortForFeed
 *   already zeroes the freshness term past 168h, so older Shorts' completion
 *   rate has no ranking effect; recomputing them would be pure waste.
 */
@Injectable()
export class ShortsWatchPercentService {
  private readonly logger = new Logger(ShortsWatchPercentService.name);
  private static readonly RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
  private static readonly MAX_PER_RUN = 2000;

  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
  ) {}

  async recompute(): Promise<{ updated: number }> {
    const since = new Date(Date.now() - ShortsWatchPercentService.RECENT_WINDOW_MS);

    const rows = await this.videoRepository.query(
      `
      SELECT
        v.id AS video_id,
        AVG(
          LEAST(wh.progress_seconds::float, NULLIF(v.duration_seconds, 0)::float)
          / NULLIF(v.duration_seconds, 0)::float
          * 100.0
        ) AS avg_watch_pct
      FROM videos v
      INNER JOIN watch_history wh ON wh.video_id = v.id
      WHERE v.video_type = $2
        AND v.status = $3
        AND v.publish_status = $4
        AND v.published_at >= $1
        AND v.duration_seconds IS NOT NULL
        AND v.duration_seconds > 0
      GROUP BY v.id
      LIMIT $5
      `,
      [since, VideoType.SHORT, VideoStatus.READY, PublishStatus.PUBLISHED, ShortsWatchPercentService.MAX_PER_RUN],
    );

    if (!rows.length) return { updated: 0 };

    const now = new Date();
    for (const row of rows as Array<{ video_id: string; avg_watch_pct: string | null }>) {
      const pct = row.avg_watch_pct != null && Number.isFinite(Number(row.avg_watch_pct))
        ? Math.round(Number(row.avg_watch_pct) * 10) / 10
        : null;
      await this.videoRepository.update(row.video_id, {
        avgWatchPercent: pct,
        watchPercentUpdatedAt: now,
      });
    }

    this.logger.log(`Shorts watch-percent recompute: updated ${rows.length} video(s)`);
    return { updated: rows.length };
  }
}
