import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import Mux from '@mux/mux-node';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Stream, StreamStatus, StreamVisibility } from './entities/stream.entity';
import { CreateStreamDto } from './dto/create-stream.dto';
import { Video, VideoStatus, VideoVisibility, PublishStatus } from '../content/entities/video.entity';
import { MuxVodService } from '../content/mux-vod.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { UserRole } from '../users/entities/user.entity';
import {
  muxHlsPlaybackUrl,
  muxPlaybackIdFromHlsUrl,
  muxThumbnailUrl,
} from '../../common/media/mux-playback.util';
import { toPublicStream } from './stream.mapper';

@Injectable()
export class StreamingService {
  private readonly logger = new Logger(StreamingService.name);
  private readonly mux: Mux;
  private static readonly MUX_SYNC_IDLE_LIMIT = 20;

  constructor(
    @InjectRepository(Stream)
    private readonly streamRepository: Repository<Stream>,
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly muxVodService: MuxVodService,
    private readonly entitlementsService: EntitlementsService,
  ) {
    this.mux = new Mux({
      tokenId: configService.get<string>('mux.tokenId') || 'placeholder',
      tokenSecret: configService.get<string>('mux.tokenSecret') || 'placeholder',
    });
  }

  async createStream(userId: string, dto: CreateStreamDto): Promise<Stream> {
    const nodeEnv = this.configService.get<string>('nodeEnv') || 'development';
    const muxTokenId = this.configService.get<string>('mux.tokenId');
    const muxTokenSecret = this.configService.get<string>('mux.tokenSecret');
    const muxConfigured =
      muxTokenId && muxTokenSecret && muxTokenId !== 'placeholder' && muxTokenSecret !== 'placeholder';

    if (nodeEnv === 'production' && !muxConfigured) {
      throw new ServiceUnavailableException('Live streaming is not configured');
    }

    let muxLiveStreamId = 'mock-stream-id';
    let streamKey = 'mock-stream-key';
    let playbackUrl: string | undefined;
    let thumbnailUrl: string | undefined = dto.thumbnailUrl?.trim() || undefined;

    const recordEnabled = dto.recordEnabled !== false;

    try {
      const response = await this.mux.video.liveStreams.create({
        playback_policy: ['public'],
        new_asset_settings: recordEnabled
          ? { playback_policy: ['public'] }
          : undefined,
        reduced_latency: true,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = response as any;
      muxLiveStreamId = raw.id ?? muxLiveStreamId;
      streamKey = raw.stream_key ?? streamKey;
      const playbackId = raw.playback_ids?.[0]?.id as string | undefined;
      if (playbackId) {
        playbackUrl = muxHlsPlaybackUrl(playbackId);
        if (!thumbnailUrl) {
          thumbnailUrl = muxThumbnailUrl(playbackId);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (nodeEnv === 'production') {
        this.logger.error(`Mux live stream create failed: ${message}`);
        throw new ServiceUnavailableException(
          'Live streaming is temporarily unavailable. Please try again shortly.',
        );
      }
      this.logger.warn('Mux API unavailable, using mock stream data', err);
    }

    const stream = this.streamRepository.create({
      userId,
      title: dto.title,
      description: dto.description,
      muxLiveStreamId,
      streamKey,
      rtmpUrl: 'rtmps://global-live.mux.com:443/app',
      playbackUrl,
      status: StreamStatus.IDLE,
      visibility: dto.visibility ?? StreamVisibility.PUBLIC,
      categoryId: dto.categoryId ?? null,
      thumbnailUrl,
      chatEnabled: dto.chatEnabled !== false,
      recordEnabled,
      ageRestricted: dto.ageRestricted === true,
      requiredTierId: dto.requiredTierId ?? null,
    });

    return this.streamRepository.save(stream);
  }

  async findById(id: string): Promise<Stream> {
    const stream = await this.streamRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!stream) throw new NotFoundException('Stream not found');
    return stream;
  }

  async getStreamForViewer(
    id: string,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ) {
    const stream = await this.syncMuxLiveStatus(await this.findById(id));
    const isOwner = !!viewerId && viewerId === stream.userId;
    const isAdmin = viewerRole === UserRole.ADMIN;

    const access = await this.entitlementsService.checkAccess({
      creatorId: stream.userId,
      visibility: stream.visibility,
      requiredTierId: stream.requiredTierId,
      viewerId,
      isOwner,
      isAdmin,
    });

    return toPublicStream(stream, isOwner, {
      hidePlayback: !access.allowed,
      accessReason: access.reason,
    });
  }

  async getLiveStreams(viewerId?: string | null, viewerRole?: UserRole | null) {
    await this.syncRecentIdleStreams();

    const streams = await this.streamRepository.find({
      where: { status: StreamStatus.LIVE },
      relations: ['user'],
      order: { startedAt: 'DESC' },
    });

    const accessList = await this.entitlementsService.checkAccessMany(
      viewerId,
      viewerRole,
      streams.map((stream) => ({
        creatorId: stream.userId,
        visibility: stream.visibility,
        requiredTierId: stream.requiredTierId,
        viewerId,
        isOwner: !!viewerId && viewerId === stream.userId,
      })),
    );

    const results = streams.map((stream, index) => {
      const access = accessList[index];
      if (!access.allowed && stream.visibility !== StreamVisibility.PUBLIC) {
        return toPublicStream(stream, false, {
          hidePlayback: true,
          accessReason: access.reason,
        });
      }
      return toPublicStream(stream, false, { hidePlayback: !access.allowed, accessReason: access.reason });
    });

    return results.filter((s) => s.visibility === StreamVisibility.PUBLIC || !s.accessDenied);
  }

  async endStream(userId: string, streamId: string): Promise<Stream> {
    const stream = await this.findById(streamId);

    if (stream.userId !== userId) {
      throw new NotFoundException('Stream not found');
    }

    if (stream.muxLiveStreamId && stream.muxLiveStreamId !== 'mock-stream-id') {
      try {
        await this.mux.video.liveStreams.disable(stream.muxLiveStreamId);
      } catch (err) {
        this.logger.warn('Failed to disable Mux stream', err);
      }
    }

    stream.status = StreamStatus.ENDED;
    stream.endedAt = new Date();
    return this.streamRepository.save(stream);
  }

  async setSlowMode(userId: string, streamId: string, slowModeSeconds: number): Promise<Stream> {
    const stream = await this.findById(streamId);
    if (stream.userId !== userId) {
      throw new NotFoundException('Stream not found');
    }
    stream.slowModeSeconds = slowModeSeconds;
    const saved = await this.streamRepository.save(stream);
    this.eventEmitter.emit('stream.slow-mode', { streamId, slowModeSeconds });
    return saved;
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

  /** Poll Mux when webhooks lag so status/playback stay accurate. */
  async syncMuxLiveStatus(stream: Stream): Promise<Stream> {
    if (
      stream.status === StreamStatus.ENDED ||
      !stream.muxLiveStreamId ||
      stream.muxLiveStreamId === 'mock-stream-id' ||
      !this.muxConfigured()
    ) {
      return stream;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const muxStream = (await this.mux.video.liveStreams.retrieve(stream.muxLiveStreamId)) as any;
      const muxStatus = muxStream.status as string | undefined;

      if (muxStatus === 'active' && stream.status !== StreamStatus.LIVE) {
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
          ...(thumbnailPatch ? { thumbnailUrl: thumbnailPatch } : {}),
        });
        stream.status = StreamStatus.LIVE;
        stream.startedAt = stream.startedAt ?? new Date();
        if (thumbnailPatch) stream.thumbnailUrl = thumbnailPatch;

        this.eventEmitter.emit('stream.started', {
          streamId: stream.id,
          userId: stream.userId,
          title: stream.title,
          visibility: stream.visibility,
          requiredTierId: stream.requiredTierId,
        });
      } else if (muxStatus === 'idle' && stream.status === StreamStatus.LIVE) {
        await this.streamRepository.update(stream.id, { status: StreamStatus.IDLE });
        stream.status = StreamStatus.IDLE;
      }
    } catch (err) {
      this.logger.warn(
        `Mux live stream sync failed for ${stream.id}: ${err instanceof Error ? err.message : err}`,
      );
    }

    return stream;
  }

  private async syncRecentIdleStreams(): Promise<void> {
    const idleCandidates = await this.streamRepository.find({
      where: {
        status: StreamStatus.IDLE,
        endedAt: IsNull(),
        muxLiveStreamId: Not(IsNull()),
      },
      order: { createdAt: 'DESC' },
      take: StreamingService.MUX_SYNC_IDLE_LIMIT,
    });

    const toSync = idleCandidates.filter(
      (s) => s.muxLiveStreamId && s.muxLiveStreamId !== 'mock-stream-id',
    );

    await Promise.all(toSync.map((s) => this.syncMuxLiveStatus(s)));
  }

  private mapStreamVisibilityToVideo(visibility: StreamVisibility): VideoVisibility {
    switch (visibility) {
      case StreamVisibility.FOLLOWERS:
        return VideoVisibility.FOLLOWERS;
      case StreamVisibility.SUBSCRIBERS:
        return VideoVisibility.SUBSCRIBERS;
      case StreamVisibility.TIER:
        return VideoVisibility.TIER;
      case StreamVisibility.PRIVATE:
        return VideoVisibility.PRIVATE;
      case StreamVisibility.PAID_EVENT:
        return VideoVisibility.PAID_EVENT;
      default:
        return VideoVisibility.PUBLIC;
    }
  }

  async handleMuxWebhook(payload: Record<string, unknown>) {
    const eventType = payload.type as string;
    const data = payload.data as Record<string, unknown>;

    if (eventType === 'video.live_stream.active') {
      const muxLiveStreamId = data.id as string;
      const stream = await this.streamRepository.findOne({ where: { muxLiveStreamId } });
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
          startedAt: new Date(),
          ...(thumbnailPatch ? { thumbnailUrl: thumbnailPatch } : {}),
        },
      );

      const updated = stream ?? (await this.streamRepository.findOne({ where: { muxLiveStreamId } }));
      if (updated) {
        this.eventEmitter.emit('stream.started', {
          streamId: updated.id,
          userId: updated.userId,
          title: updated.title,
          visibility: updated.visibility,
          requiredTierId: updated.requiredTierId,
        });
      }
    } else if (eventType === 'video.live_stream.recording') {
      const muxLiveStreamId = data.id as string;
      const activeAssetId = data.active_asset_id as string | undefined;
      if (activeAssetId) {
        await this.streamRepository.update({ muxLiveStreamId }, { muxAssetId: activeAssetId });
      }
    } else if (eventType === 'video.live_stream.idle') {
      await this.streamRepository.update(
        { muxLiveStreamId: data.id as string },
        { status: StreamStatus.IDLE },
      );

      const stream = await this.streamRepository.findOne({ where: { muxLiveStreamId: data.id as string } });
      if (stream) {
        this.eventEmitter.emit('stream.ended', { streamId: stream.id, userId: stream.userId, title: stream.title });
      }
    } else if (eventType === 'video.asset.ready') {
      const handledVod = await this.muxVodService.handleAssetReady(payload);
      if (handledVod) return;

      const assetId = data.id as string;
      const playbackIds = (data.playback_ids as Array<{ id: string; policy: string }> | undefined) || [];
      const playbackId = playbackIds[0]?.id;
      if (!assetId || !playbackId) return;

      const stream = await this.streamRepository.findOne({ where: { muxAssetId: assetId } });
      if (!stream) return;

      const hlsUrl = `https://stream.mux.com/${playbackId}.m3u8`;
      const videoVisibility = this.mapStreamVisibilityToVideo(stream.visibility);

      const video = await this.videoRepository.save(
        this.videoRepository.create({
          userId: stream.userId,
          title: stream.title || 'Live session',
          description: stream.description || null,
          status: VideoStatus.READY,
          visibility: videoVisibility,
          requiredTierId: stream.requiredTierId,
          sourceStreamId: stream.id,
          hlsUrl,
          thumbnailUrl: stream.thumbnailUrl || `https://image.mux.com/${playbackId}/thumbnail.jpg`,
          muxAssetId: assetId,
          muxPlaybackId: playbackId,
          s3Key: null,
          uploadContentType: null,
          uploadFileSizeBytes: null,
          uploadCompletedAt: null,
          failureReason: null,
          publishStatus: PublishStatus.PUBLISHED,
          publishedAt: new Date(),
        }),
      );

      this.eventEmitter.emit('premium.content.new', {
        videoId: video.id,
        creatorId: stream.userId,
        visibility: videoVisibility,
        requiredTierId: stream.requiredTierId,
        title: video.title,
      });
    } else if (eventType === 'video.asset.errored') {
      await this.muxVodService.handleAssetErrored(payload);
    }
  }
}
