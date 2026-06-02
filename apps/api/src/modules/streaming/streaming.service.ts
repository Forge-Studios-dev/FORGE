import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Mux from '@mux/mux-node';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Stream, StreamStatus } from './entities/stream.entity';
import { CreateStreamDto } from './dto/create-stream.dto';
import { Video, VideoStatus, VideoVisibility } from '../content/entities/video.entity';
import { MuxVodService } from '../content/mux-vod.service';

@Injectable()
export class StreamingService {
  private readonly logger = new Logger(StreamingService.name);
  private readonly mux: Mux;

  constructor(
    @InjectRepository(Stream)
    private readonly streamRepository: Repository<Stream>,
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly muxVodService: MuxVodService,
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

    try {
      const response = await this.mux.video.liveStreams.create({
        playback_policy: ['public'],
        new_asset_settings: { playback_policy: ['public'] },
        reduced_latency: true,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = response as any;
      muxLiveStreamId = raw.id ?? muxLiveStreamId;
      streamKey = raw.stream_key ?? streamKey;
      if (raw.playback_ids?.[0]?.id) {
        playbackUrl = `https://stream.mux.com/${raw.playback_ids[0].id}.m3u8`;
      }
    } catch (err) {
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

  async getLiveStreams(): Promise<Stream[]> {
    return this.streamRepository.find({
      where: { status: StreamStatus.LIVE },
      relations: ['user'],
      order: { startedAt: 'DESC' },
    });
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

  async handleMuxWebhook(payload: Record<string, unknown>) {
    const eventType = payload.type as string;
    const data = payload.data as Record<string, unknown>;

    if (eventType === 'video.live_stream.active') {
      await this.streamRepository.update(
        { muxLiveStreamId: data.id as string },
        { status: StreamStatus.LIVE, startedAt: new Date() },
      );

      const stream = await this.streamRepository.findOne({ where: { muxLiveStreamId: data.id as string } });
      if (stream) {
        this.eventEmitter.emit('stream.started', {
          streamId: stream.id,
          userId: stream.userId,
          title: stream.title,
        });
      }
    } else if (eventType === 'video.live_stream.recording') {
      // Recording started; active_asset_id can be used to map live -> VOD asset later.
      const muxLiveStreamId = data.id as string;
      const activeAssetId = data.active_asset_id as string | undefined;
      if (activeAssetId) {
        await this.streamRepository.update(
          { muxLiveStreamId },
          { muxAssetId: activeAssetId },
        );
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

      // Live recording → new VOD row when stream has mux_asset_id (no passthrough).
      const assetId = data.id as string;
      const playbackIds = (data.playback_ids as Array<{ id: string; policy: string }> | undefined) || [];
      const playbackId = playbackIds[0]?.id;
      if (!assetId || !playbackId) return;

      const stream = await this.streamRepository.findOne({ where: { muxAssetId: assetId } });
      if (!stream) return;

      const hlsUrl = `https://stream.mux.com/${playbackId}.m3u8`;
      await this.videoRepository.save(
        this.videoRepository.create({
          userId: stream.userId,
          title: stream.title || 'Live session',
          description: stream.description || null,
          status: VideoStatus.READY,
          visibility: VideoVisibility.PUBLIC,
          hlsUrl,
          thumbnailUrl: `https://image.mux.com/${playbackId}/thumbnail.jpg`,
          muxAssetId: assetId,
          muxPlaybackId: playbackId,
          s3Key: null,
          uploadContentType: null,
          uploadFileSizeBytes: null,
          uploadCompletedAt: null,
          failureReason: null,
        }),
      );
    } else if (eventType === 'video.asset.errored') {
      await this.muxVodService.handleAssetErrored(payload);
    }
  }
}
