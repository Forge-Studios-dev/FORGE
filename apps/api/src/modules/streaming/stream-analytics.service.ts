import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { safeRedisGet, safeRedisSetex } from '../../common/redis/redis-safe.util';
import { StreamAnalyticsSnapshot } from './entities/stream-analytics-snapshot.entity';
import { Stream, StreamStatus } from './entities/stream.entity';
import { StreamMessage, StreamMessageType } from '../stream-chat/entities/stream-message.entity';
import { StreamEventPurchase } from './entities/stream-event-purchase.entity';
import { StreamPollVote } from './entities/stream-poll-vote.entity';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class StreamAnalyticsService {
  private readonly logger = new Logger(StreamAnalyticsService.name);
  private static readonly ANALYTICS_CACHE_TTL_SEC = 30;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    @InjectRepository(StreamAnalyticsSnapshot)
    private readonly snapshotRepository: Repository<StreamAnalyticsSnapshot>,
    @InjectRepository(Stream)
    private readonly streamRepository: Repository<Stream>,
    @InjectRepository(StreamMessage)
    private readonly messageRepository: Repository<StreamMessage>,
    @InjectRepository(StreamEventPurchase)
    private readonly purchaseRepository: Repository<StreamEventPurchase>,
    @InjectRepository(StreamPollVote)
    private readonly pollVoteRepository: Repository<StreamPollVote>,
  ) {}

  async recordSnapshot(streamId: string, concurrentViewers: number): Promise<void> {
    const oneMinuteAgo = new Date(Date.now() - 60_000);
    const chatCount = await this.messageRepository
      .createQueryBuilder('m')
      .where('m.stream_id = :streamId', { streamId })
      .andWhere('m.created_at >= :since', { since: oneMinuteAgo })
      .andWhere('m.deleted_at IS NULL')
      .getCount();

    await this.snapshotRepository.save(
      this.snapshotRepository.create({
        streamId,
        recordedAt: new Date(),
        concurrentViewers,
        chatMessagesPerMin: chatCount,
      }),
    );
    try {
      await this.redis.del(`stream:analytics:${streamId}`);
    } catch {
      // non-fatal
    }
  }

  async getCreatorStreamAnalytics(
    creatorId: string,
    streamId: string,
    requesterId: string,
    requesterRole?: UserRole | null,
  ) {
    const cacheKey = `stream:analytics:${streamId}`;
    const cached = await safeRedisGet(this.redis, cacheKey, this.logger);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        await this.redis.del(cacheKey);
      }
    }

    const stream = await this.streamRepository.findOne({ where: { id: streamId } });
    if (!stream) throw new NotFoundException('Stream not found');
    if (stream.userId !== creatorId) throw new NotFoundException('Stream not found');
    if (requesterId !== creatorId && requesterRole !== UserRole.ADMIN) {
      throw new ForbiddenException();
    }

    const agg = await this.snapshotRepository
      .createQueryBuilder('s')
      .select('MAX(s.concurrentViewers)', 'peak')
      .addSelect('AVG(s.concurrentViewers)', 'avg')
      .where('s.streamId = :streamId', { streamId })
      .getRawOne<{ peak: string | null; avg: string | null }>();

    const recentSnapshots = await this.snapshotRepository.find({
      where: { streamId },
      order: { recordedAt: 'DESC' },
      take: 60,
    });
    recentSnapshots.reverse();

    const peakViewers = agg?.peak ? parseInt(agg.peak, 10) : stream.viewerCount;
    const avgViewers = agg?.avg
      ? Math.round(parseFloat(agg.avg))
      : stream.viewerCount;

    const totalChat = await this.messageRepository.count({
      where: { streamId },
    });

    const superChatRevenue = await this.messageRepository
      .createQueryBuilder('m')
      .select('COALESCE(SUM(m.amount_cents), 0)', 'total')
      .where('m.stream_id = :streamId', { streamId })
      .andWhere('m.message_type = :type', { type: StreamMessageType.SUPER_CHAT })
      .getRawOne<{ total: string }>();

    const ticketRevenue = await this.purchaseRepository
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount_cents), 0)', 'total')
      .addSelect('COUNT(*)', 'count')
      .where('p.stream_id = :streamId', { streamId })
      .andWhere('p.status = :status', { status: 'completed' })
      .getRawOne<{ total: string; count: string }>();

    const pollVotes = await this.pollVoteRepository
      .createQueryBuilder('v')
      .innerJoin('stream_polls', 'p', 'p.id = v.poll_id')
      .where('p.stream_id = :streamId', { streamId })
      .getCount();

    const durationMs =
      stream.startedAt && stream.endedAt
        ? stream.endedAt.getTime() - stream.startedAt.getTime()
        : stream.startedAt
          ? Date.now() - stream.startedAt.getTime()
          : 0;

    const result = {
      streamId,
      status: stream.status,
      peakViewers,
      avgViewers,
      currentViewers: stream.viewerCount,
      totalChatMessages: totalChat,
      uniqueViewers: stream.uniqueViewerCount ?? 0,
      superChatRevenueCents: parseInt(superChatRevenue?.total ?? '0', 10),
      ticketRevenueCents: parseInt(ticketRevenue?.total ?? '0', 10),
      ticketSalesCount: parseInt(ticketRevenue?.count ?? '0', 10),
      totalPollVotes: pollVotes,
      durationSeconds: Math.max(0, Math.floor(durationMs / 1000)),
      snapshots: recentSnapshots,
      isLive: stream.status === StreamStatus.LIVE,
    };

    await safeRedisSetex(
      this.redis,
      cacheKey,
      StreamAnalyticsService.ANALYTICS_CACHE_TTL_SEC,
      JSON.stringify(result),
      this.logger,
    );
    return result;
  }
}
