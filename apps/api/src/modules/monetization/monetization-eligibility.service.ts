import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatorStatus, User } from '../users/entities/user.entity';
import { Video, VideoType } from '../content/entities/video.entity';
import { WatchHistory } from '../engagement/entities/watch-history.entity';

/** YouTube Partner Program's own published thresholds — not invented here. */
const MIN_SUBSCRIBERS = 1000;
const MIN_WATCH_HOURS_365D = 4000;
const MIN_SHORTS_VIEWS_90D = 10_000_000;

export interface MonetizationEligibilitySnapshot {
  eligible: boolean;
  subscriberCount: number;
  subscriberThreshold: number;
  watchHours365d: number;
  watchHoursThreshold: number;
  shortsViews90d: number;
  shortsViewsThreshold: number;
  meetsAudienceThreshold: boolean;
  isApprovedCreator: boolean;
  hasActiveUploadRestriction: boolean;
  uploadRestrictedUntil: Date | null;
}

/**
 * Read-only eligibility check against YouTube Partner Program's published
 * criteria (1,000 subscribers AND (4,000 public watch hours in the trailing
 * 12 months OR 10M Shorts views in the trailing 90 days), no active
 * strike-driven upload restriction, approved creator status). This mirrors
 * YouTube's own numbers rather than inventing a threshold — see
 * docs/MONETIZATION.md. It does not itself unlock any revenue feature; ad
 * revenue and revenue-share terms are a separate, not-yet-built decision
 * (no ad network is integrated).
 */
@Injectable()
export class MonetizationEligibilityService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectRepository(WatchHistory)
    private readonly watchHistoryRepository: Repository<WatchHistory>,
  ) {}

  async getEligibility(creatorId: string): Promise<MonetizationEligibilitySnapshot> {
    const user = await this.userRepository.findOne({ where: { id: creatorId } });
    if (!user) throw new NotFoundException('User not found');

    const since365d = new Date();
    since365d.setUTCDate(since365d.getUTCDate() - 365);
    const since90d = new Date();
    since90d.setUTCDate(since90d.getUTCDate() - 90);

    const [watchHours365d, shortsViews90d] = await Promise.all([
      this.getWatchHours(creatorId, since365d),
      this.getShortsViews(creatorId, since90d),
    ]);

    const subscriberCount = user.followerCount ?? 0;
    const meetsAudienceThreshold =
      watchHours365d >= MIN_WATCH_HOURS_365D || shortsViews90d >= MIN_SHORTS_VIEWS_90D;
    const isApprovedCreator = user.creatorStatus === CreatorStatus.APPROVED;
    const hasActiveUploadRestriction = Boolean(
      user.uploadRestrictedUntil && user.uploadRestrictedUntil > new Date(),
    );

    const eligible =
      subscriberCount >= MIN_SUBSCRIBERS &&
      meetsAudienceThreshold &&
      isApprovedCreator &&
      !hasActiveUploadRestriction;

    return {
      eligible,
      subscriberCount,
      subscriberThreshold: MIN_SUBSCRIBERS,
      watchHours365d,
      watchHoursThreshold: MIN_WATCH_HOURS_365D,
      shortsViews90d,
      shortsViewsThreshold: MIN_SHORTS_VIEWS_90D,
      meetsAudienceThreshold,
      isApprovedCreator,
      hasActiveUploadRestriction,
      uploadRestrictedUntil: user.uploadRestrictedUntil ?? null,
    };
  }

  /**
   * Approximate — `watch_history.progress_seconds` is the viewer's furthest
   * playback position (overwritten per rewatch), not a true cumulative
   * watch-time counter, but it's the only per-view duration signal this
   * codebase records and is a standard proxy for aggregate watch depth.
   */
  private async getWatchHours(creatorId: string, since: Date): Promise<number> {
    const row = await this.watchHistoryRepository
      .createQueryBuilder('wh')
      .innerJoin(Video, 'v', 'v.id = wh.video_id')
      .select('COALESCE(SUM(wh.progress_seconds), 0)', 'totalSeconds')
      .where('v.user_id = :creatorId', { creatorId })
      .andWhere('wh.watched_at >= :since', { since })
      .getRawOne<{ totalSeconds: string }>();
    return Number(row?.totalSeconds ?? 0) / 3600;
  }

  /**
   * Approximate — `Video.viewCount` is a lifetime counter with no per-event
   * timestamps, so this sums lifetime views for Shorts *published* in the
   * trailing 90 days rather than views *accrued* in that window.
   */
  private async getShortsViews(creatorId: string, since: Date): Promise<number> {
    const row = await this.videoRepository
      .createQueryBuilder('v')
      .select('COALESCE(SUM(v.view_count), 0)', 'totalViews')
      .where('v.user_id = :creatorId', { creatorId })
      .andWhere('v.video_type = :type', { type: VideoType.SHORT })
      .andWhere('v.published_at >= :since', { since })
      .getRawOne<{ totalViews: string }>();
    return Number(row?.totalViews ?? 0);
  }
}
