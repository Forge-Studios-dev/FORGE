import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DataSource, Repository } from 'typeorm';
import {
  ANALYTICS_MAX_PROPERTIES_BYTES,
  isAllowedAnalyticsEvent,
} from '@forge/shared-types';
import { AnalyticsEvent } from './entities/analytics-event.entity';
import { IngestEventDto } from './dto/ingest-event.dto';
import { ANALYTICS_INGEST_QUEUE } from './analytics-ingest.constants';
import type { AnalyticsIngestJob } from '../workers/analytics-ingest/analytics-ingest.worker';

export type StudioVideoPerformance = {
  periodDays: number;
  impressions: number;
  views: number;
  /** Views / impressions when impressions > 0; otherwise null. */
  ctr: number | null;
  /** Mean watch progress as % of duration (0–100) from watch history. */
  avgWatchPercent: number | null;
  topVideos: Array<{
    videoId: string;
    title: string;
    views: number;
    impressions: number;
    ctr: number | null;
    avgWatchPercent: number | null;
  }>;
};

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(AnalyticsEvent)
    private readonly analyticsRepository: Repository<AnalyticsEvent>,
    @InjectQueue(ANALYTICS_INGEST_QUEUE)
    private readonly analyticsQueue: Queue<AnalyticsIngestJob>,
    private readonly dataSource: DataSource,
  ) {}

  async ingest(userId: string | null, dto: IngestEventDto) {
    if (!isAllowedAnalyticsEvent(dto.eventName)) {
      throw new BadRequestException(`Unknown analytics event: ${dto.eventName}`);
    }
    if (dto.properties) {
      const size = Buffer.byteLength(JSON.stringify(dto.properties), 'utf8');
      if (size > ANALYTICS_MAX_PROPERTIES_BYTES) {
        throw new BadRequestException('Analytics properties payload too large');
      }
    }
    await this.analyticsQueue.add(
      'ingest',
      {
        eventName: dto.eventName,
        properties: dto.properties ?? null,
        userId,
        videoId: dto.videoId ?? null,
      },
      {
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    );
  }

  async summarySince(since: Date) {
    const qb = this.analyticsRepository
      .createQueryBuilder('e')
      .select('e.eventName', 'eventName')
      .addSelect('COUNT(*)', 'count')
      .where('e.createdAt >= :since', { since })
      .groupBy('e.eventName');

    const byEvent = await qb.getRawMany<{ eventName: string; count: string }>();
    const totalEvents = await this.analyticsRepository
      .createQueryBuilder('e')
      .where('e.createdAt >= :since', { since })
      .getCount();

    return { since: since.toISOString(), totalEvents, byEvent };
  }

  /**
   * Studio foundation metrics from impressions + views + watch-history retention.
   * CTR requires `video.impression` beacons; avg watch % uses watch_history.
   */
  async getStudioVideoPerformance(
    creatorId: string,
    periodDays = 28,
  ): Promise<StudioVideoPerformance> {
    const days = Math.min(Math.max(periodDays, 1), 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [totals, topRows] = await Promise.all([
      this.dataSource.query<
        {
          impressions: string;
          views: string;
          avg_watch_pct: string | null;
        }[]
      >(
        `
        SELECT
          (
            SELECT COUNT(*)::int
            FROM analytics_events ae
            INNER JOIN videos v ON v.id = ae.video_id
            WHERE v.user_id = $1
              AND ae.event_name = 'video.impression'
              AND ae.created_at >= $2
          ) AS impressions,
          (
            SELECT COALESCE(SUM(v.view_count), 0)::bigint
            FROM videos v
            WHERE v.user_id = $1
              AND v.status = 'ready'
          ) AS views,
          (
            SELECT AVG(
              LEAST(wh.progress_seconds::float, NULLIF(v.duration_seconds, 0)::float)
              / NULLIF(v.duration_seconds, 0)::float
              * 100.0
            )
            FROM watch_history wh
            INNER JOIN videos v ON v.id = wh.video_id
            WHERE v.user_id = $1
              AND wh.watched_at >= $2
              AND v.duration_seconds IS NOT NULL
              AND v.duration_seconds > 0
          ) AS avg_watch_pct
        `,
        [creatorId, since],
      ),
      this.dataSource.query<
        {
          video_id: string;
          title: string;
          views: string;
          impressions: string;
          avg_watch_pct: string | null;
        }[]
      >(
        `
        SELECT
          v.id AS video_id,
          v.title,
          v.view_count::text AS views,
          COALESCE(imp.impressions, 0)::text AS impressions,
          ret.avg_watch_pct::text AS avg_watch_pct
        FROM videos v
        LEFT JOIN (
          SELECT ae.video_id, COUNT(*)::int AS impressions
          FROM analytics_events ae
          WHERE ae.event_name = 'video.impression'
            AND ae.created_at >= $2
          GROUP BY ae.video_id
        ) imp ON imp.video_id = v.id
        LEFT JOIN (
          SELECT
            wh.video_id,
            AVG(
              LEAST(wh.progress_seconds::float, NULLIF(v2.duration_seconds, 0)::float)
              / NULLIF(v2.duration_seconds, 0)::float
              * 100.0
            ) AS avg_watch_pct
          FROM watch_history wh
          INNER JOIN videos v2 ON v2.id = wh.video_id
          WHERE wh.watched_at >= $2
            AND v2.duration_seconds IS NOT NULL
            AND v2.duration_seconds > 0
          GROUP BY wh.video_id
        ) ret ON ret.video_id = v.id
        WHERE v.user_id = $1
          AND v.status = 'ready'
        ORDER BY v.view_count DESC
        LIMIT 10
        `,
        [creatorId, since],
      ),
    ]);

    const row = totals[0];
    const impressions = Number(row?.impressions ?? 0);
    const views = Number(row?.views ?? 0);
    const avgWatchPercent =
      row?.avg_watch_pct != null && Number.isFinite(Number(row.avg_watch_pct))
        ? Math.round(Number(row.avg_watch_pct) * 10) / 10
        : null;
    const ctr =
      impressions > 0 ? Math.round((views / impressions) * 1000) / 1000 : null;

    return {
      periodDays: days,
      impressions,
      views,
      ctr,
      avgWatchPercent,
      topVideos: topRows.map((r) => {
        const v = Number(r.views);
        const i = Number(r.impressions);
        const aw =
          r.avg_watch_pct != null && Number.isFinite(Number(r.avg_watch_pct))
            ? Math.round(Number(r.avg_watch_pct) * 10) / 10
            : null;
        return {
          videoId: r.video_id,
          title: r.title,
          views: v,
          impressions: i,
          ctr: i > 0 ? Math.round((v / i) * 1000) / 1000 : null,
          avgWatchPercent: aw,
        };
      }),
    };
  }
}
