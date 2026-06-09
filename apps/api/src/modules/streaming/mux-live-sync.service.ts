import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Repository, IsNull, Not, LessThanOrEqual } from 'typeorm';
import Mux from '@mux/mux-node';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Stream, StreamStatus } from './entities/stream.entity';
import { StreamViewerService } from './stream-viewer.service';
import {
  muxPlaybackIdFromHlsUrl,
  muxThumbnailUrl,
} from '../../common/media/mux-playback.util';

@Injectable()
export class MuxLiveSyncService {
  private readonly logger = new Logger(MuxLiveSyncService.name);
  private readonly mux: Mux;

  private static readonly MUX_SYNC_IDLE_LIMIT = 20;
  private static readonly IDLE_SYNC_LOCK_KEY = 'streams:mux:idle-sync:lock';
  private static readonly IDLE_SYNC_LOCK_TTL_SEC = 45;
  private static readonly MUX_SYNC_TTL_IDLE_SEC = 15;
  private static readonly MUX_SYNC_TTL_LIVE_SEC = 60;
  private static readonly LIVE_GRACE_SCAN_LIMIT = 50;

  constructor(
    @InjectRepository(Stream)
    private readonly streamRepository: Repository<Stream>,
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly streamViewerService: StreamViewerService,
  ) {
    this.mux = new Mux({
      tokenId: configService.get<string>('mux.tokenId') || 'placeholder',
      tokenSecret: configService.get<string>('mux.tokenSecret') || 'placeholder',
    });
  }

  async syncStreamById(streamId: string): Promise<void> {
    const stream = await this.streamRepository.findOne({ where: { id: streamId } });
    if (!stream) return;
    await this.syncStream(stream);
  }

  /** Periodic worker scan: idle go-live reconciliation + idle-grace finalization + Mux poll. */
  async runPeriodicScan(): Promise<{ synced: number; finalized: number }> {
    const hasGraceWork = await this.hasStreamsPastIdleGrace();
    if (!hasGraceWork && !(await this.hasMuxSyncCandidates())) {
      return { synced: 0, finalized: 0 };
    }

    const finalized = hasGraceWork ? await this.finalizeStreamsPastIdleGrace() : 0;
    const synced = await this.syncIdleCandidateStreams();
    return { synced, finalized };
  }

  /** True when any stream is currently LIVE (Redis index or DB). Used for adaptive sync interval. */
  async hasActiveLiveStreams(): Promise<boolean> {
    try {
      const liveCount = await this.redis.scard('streams:live:ids');
      if (liveCount > 0) return true;
    } catch {
      // fall through
    }
    const dbLive = await this.streamRepository.count({
      where: { status: StreamStatus.LIVE },
    });
    return dbLive > 0;
  }

  /** True when Redis live index or DB has IDLE streams eligible for Mux poll. */
  private async hasMuxSyncCandidates(): Promise<boolean> {
    try {
      const liveCount = await this.redis.scard('streams:live:ids');
      if (liveCount > 0) return true;
    } catch {
      // fall through to DB probe
    }

    if (!this.muxConfigured()) return false;

    const idleCount = await this.streamRepository.count({
      where: {
        status: StreamStatus.IDLE,
        endedAt: IsNull(),
        muxLiveStreamId: Not(IsNull()),
      },
    });
    return idleCount > 0;
  }

  private async hasStreamsPastIdleGrace(): Promise<boolean> {
    const cutoff = new Date(Date.now() - this.idleGraceMs());
    const count = await this.streamRepository.count({
      where: {
        status: StreamStatus.LIVE,
        muxIdleSince: LessThanOrEqual(cutoff),
      },
    });
    return count > 0;
  }

  async handleWebhookActive(muxLiveStreamId: string): Promise<void> {
    const stream = await this.streamRepository.findOne({ where: { muxLiveStreamId } });
    const isFirstGoLive = stream && !stream.startedAt;
    const thumbnailPatch =
      stream && !stream.thumbnailUrl && stream.playbackUrl
        ? (() => {
            const pb = muxPlaybackIdFromHlsUrl(stream.playbackUrl);
            return pb ? muxThumbnailUrl(pb) : undefined;
          })()
        : undefined;

    await this.streamRepository.update(
      { muxLiveStreamId },
      {
        status: StreamStatus.LIVE,
        startedAt: stream?.startedAt ?? new Date(),
        muxIdleSince: null,
        ...(thumbnailPatch ? { thumbnailUrl: thumbnailPatch } : {}),
      },
    );

    const updated = stream ?? (await this.streamRepository.findOne({ where: { muxLiveStreamId } }));
    if (!updated) return;

    await this.streamViewerService.trackStreamLive(updated.id);
    await this.redis.del(this.muxSyncCacheKey(updated.id));

    if (isFirstGoLive) {
      this.eventEmitter.emit('stream.started', {
        streamId: updated.id,
        userId: updated.userId,
        title: updated.title,
        visibility: updated.visibility,
        requiredTierId: updated.requiredTierId,
      });
    }
  }

  async handleWebhookIdle(muxLiveStreamId: string): Promise<void> {
    const stream = await this.streamRepository.findOne({ where: { muxLiveStreamId } });
    if (!stream || stream.status !== StreamStatus.LIVE) return;

    await this.streamRepository.update(
      { muxLiveStreamId },
      { muxIdleSince: stream.muxIdleSince ?? new Date() },
    );
  }

  async syncStream(stream: Stream): Promise<Stream> {
    if (
      stream.status === StreamStatus.ENDED ||
      !stream.muxLiveStreamId ||
      stream.muxLiveStreamId === 'mock-stream-id' ||
      !this.muxConfigured()
    ) {
      return stream;
    }

    const ttlSec =
      stream.status === StreamStatus.IDLE
        ? MuxLiveSyncService.MUX_SYNC_TTL_IDLE_SEC
        : MuxLiveSyncService.MUX_SYNC_TTL_LIVE_SEC;
    const cacheKey = this.muxSyncCacheKey(stream.id);
    const recentlySynced = await this.redis.get(cacheKey);
    if (recentlySynced) return stream;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const muxStream = (await this.mux.video.liveStreams.retrieve(stream.muxLiveStreamId)) as any;
      const muxStatus = muxStream.status as string | undefined;

      if (muxStatus === 'active') {
        await this.applyActiveState(stream);
      } else if (muxStatus === 'idle' && stream.status === StreamStatus.LIVE) {
        const idleSince = stream.muxIdleSince ?? new Date();
        if (!stream.muxIdleSince) {
          await this.streamRepository.update(stream.id, { muxIdleSince: idleSince });
          stream.muxIdleSince = idleSince;
        } else if (Date.now() - idleSince.getTime() >= this.idleGraceMs()) {
          await this.finalizeStreamEnded(stream);
        }
      }
    } catch (err) {
      this.logger.warn(
        `Mux live stream sync failed for ${stream.id}: ${err instanceof Error ? err.message : err}`,
      );
      return stream;
    }

    await this.redis.setex(cacheKey, ttlSec, '1');
    return stream;
  }

  async finalizeStreamEnded(stream: Stream): Promise<void> {
    if (stream.status === StreamStatus.ENDED) return;
    await this.streamRepository.update(stream.id, {
      status: StreamStatus.ENDED,
      endedAt: new Date(),
      muxIdleSince: null,
    });
    await this.streamViewerService.trackStreamEnded(stream.id);
    this.eventEmitter.emit('stream.ended', {
      streamId: stream.id,
      userId: stream.userId,
      title: stream.title,
    });
  }

  private async applyActiveState(stream: Stream): Promise<void> {
    const isFirstGoLive = !stream.startedAt;
    const thumbnailPatch =
      !stream.thumbnailUrl && stream.playbackUrl
        ? (() => {
            const pb = muxPlaybackIdFromHlsUrl(stream.playbackUrl);
            return pb ? muxThumbnailUrl(pb) : undefined;
          })()
        : undefined;

    await this.streamRepository.update(stream.id, {
      status: StreamStatus.LIVE,
      startedAt: stream.startedAt ?? new Date(),
      muxIdleSince: null,
      ...(thumbnailPatch ? { thumbnailUrl: thumbnailPatch } : {}),
    });

    await this.streamViewerService.trackStreamLive(stream.id);

    if (isFirstGoLive) {
      this.eventEmitter.emit('stream.started', {
        streamId: stream.id,
        userId: stream.userId,
        title: stream.title,
        visibility: stream.visibility,
        requiredTierId: stream.requiredTierId,
      });
    }
  }

  private async finalizeStreamsPastIdleGrace(): Promise<number> {
    const cutoff = new Date(Date.now() - this.idleGraceMs());
    const candidates = await this.streamRepository.find({
      where: {
        status: StreamStatus.LIVE,
        muxIdleSince: LessThanOrEqual(cutoff),
      },
      take: MuxLiveSyncService.LIVE_GRACE_SCAN_LIMIT,
    });

    for (const stream of candidates) {
      await this.finalizeStreamEnded(stream);
    }
    return candidates.length;
  }

  private async syncIdleCandidateStreams(): Promise<number> {
    const acquired = await this.redis.set(
      MuxLiveSyncService.IDLE_SYNC_LOCK_KEY,
      '1',
      'EX',
      MuxLiveSyncService.IDLE_SYNC_LOCK_TTL_SEC,
      'NX',
    );
    if (acquired !== 'OK') return 0;

    const idleCandidates = await this.streamRepository.find({
      where: {
        status: StreamStatus.IDLE,
        endedAt: IsNull(),
        muxLiveStreamId: Not(IsNull()),
      },
      order: { createdAt: 'DESC' },
      take: MuxLiveSyncService.MUX_SYNC_IDLE_LIMIT,
    });

    const toSync = idleCandidates.filter(
      (s) => s.muxLiveStreamId && s.muxLiveStreamId !== 'mock-stream-id',
    );

    await Promise.all(toSync.map((s) => this.syncStream(s)));
    return toSync.length;
  }

  private muxSyncCacheKey(streamId: string): string {
    return `stream:mux:sync:${streamId}`;
  }

  private muxConfigured(): boolean {
    const muxTokenId = this.configService.get<string>('mux.tokenId');
    const muxTokenSecret = this.configService.get<string>('mux.tokenSecret');
    return !!(
      muxTokenId &&
      muxTokenSecret &&
      muxTokenId !== 'placeholder' &&
      muxTokenSecret !== 'placeholder'
    );
  }

  private idleGraceMs(): number {
    const sec = this.configService.get<number>('mux.idleGraceSec') ?? 60;
    return sec * 1000;
  }
}
