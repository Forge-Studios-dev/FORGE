import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import Mux from '@mux/mux-node';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  Video,
  VideoStatus,
  TranscodeProvider,
} from './entities/video.entity';
import { createS3Client } from '../../common/create-s3-client';
import { indexedAtOnReady, publishStatusOnReady } from './video-publish.util';
import { videoDetailCacheKey } from './video-cache';
import { muxHlsPlaybackUrl, muxThumbnailUrl } from './mux-vod.constants';
import { MuxSigningService } from './mux-signing.service';
import { VideoVisibility } from './entities/video.entity';

export interface MuxVodIngestJob {
  videoId: string;
  s3Key: string;
  userId: string;
}

@Injectable()
export class MuxVodService {
  private readonly logger = new Logger(MuxVodService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly mux: Mux;

  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly muxSigning: MuxSigningService,
    @InjectRedis()
    private readonly redis: Redis,
  ) {
    this.s3 = createS3Client({
      region: configService.get<string>('aws.region') || 'ap-south-1',
      accessKeyId: configService.get<string>('aws.accessKeyId') || '',
      secretAccessKey: configService.get<string>('aws.secretAccessKey') || '',
    });
    this.bucket = configService.get<string>('aws.s3BucketName') || '';
    this.mux = new Mux({
      tokenId: configService.get<string>('mux.tokenId') || 'placeholder',
      tokenSecret: configService.get<string>('mux.tokenSecret') || 'placeholder',
    });
  }

  isMuxConfigured(): boolean {
    const id = this.configService.get<string>('mux.tokenId') || '';
    const secret = this.configService.get<string>('mux.tokenSecret') || '';
    return (
      id.length > 0 &&
      secret.length > 0 &&
      id !== 'placeholder' &&
      secret !== 'placeholder'
    );
  }

  async ingestFromS3(job: MuxVodIngestJob): Promise<void> {
    const { videoId, s3Key, userId } = job;
    if (!this.isMuxConfigured()) {
      throw new ServiceUnavailableException('Mux Video is not configured');
    }

    const video = await this.videoRepository.findOne({ where: { id: videoId } });
    if (!video) throw new NotFoundException('Video not found');
    if (video.muxAssetId) {
      this.logger.log(`Mux ingest skipped — asset already exists for ${videoId}`);
      return;
    }

    const ttlSec = this.configService.get<number>('video.muxIngestUrlTtlSec') || 43_200;
    const signedUrl = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: s3Key }),
      { expiresIn: ttlSec },
    );

    this.logger.log(JSON.stringify({ msg: 'mux_vod_ingest_start', videoId, s3Key }));

    const playbackPolicy = this.muxSigning.playbackPolicyForVisibility(
      video.visibility ?? VideoVisibility.PUBLIC,
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await this.mux.video.assets.create({
      inputs: [{ url: signedUrl }],
      playback_policy: playbackPolicy,
      passthrough: videoId,
      max_resolution_tier: '1080p',
      encoding_tier: 'smart',
    } as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const asset = response as any;
    const assetId = asset.id as string | undefined;
    if (!assetId) {
      throw new Error('Mux asset create returned no asset id');
    }

    await this.videoRepository.update(videoId, {
      muxAssetId: assetId,
      transcodeProvider: TranscodeProvider.MUX,
      status: VideoStatus.PROCESSING,
      failureReason: null,
    });

    this.logger.log(JSON.stringify({ msg: 'mux_vod_ingest_submitted', videoId, assetId, userId }));
  }

  /**
   * Handles `video.asset.ready` for VOD uploads (passthrough = video UUID).
   * @returns true when a video row was updated (caller should skip live-recording fallback).
   */
  async handleAssetReady(payload: Record<string, unknown>): Promise<boolean> {
    const data = payload.data as Record<string, unknown> | undefined;
    if (!data) return false;

    const assetId = data.id as string | undefined;
    const passthrough = typeof data.passthrough === 'string' ? data.passthrough.trim() : '';
    const playbackIds = (data.playback_ids as Array<{ id: string }> | undefined) || [];
    const playbackId = playbackIds[0]?.id;
    const duration = typeof data.duration === 'number' ? data.duration : null;

    if (!assetId || !playbackId) return false;

    let video: Video | null = null;
    if (passthrough) {
      video = await this.videoRepository.findOne({
        where: { id: passthrough },
        relations: ['skillTags'],
      });
    }
    if (!video) {
      video = await this.videoRepository.findOne({
        where: { muxAssetId: assetId },
        relations: ['skillTags'],
      });
    }
    if (!video) return false;

    if (video.status === VideoStatus.READY && video.muxPlaybackId === playbackId) {
      return true;
    }

    const hlsUrl = muxHlsPlaybackUrl(playbackId);
    const thumbnailUrl = muxThumbnailUrl(playbackId);
    const now = new Date();
    const scheduled = video.scheduledPublishAt;
    const publishedAt =
      scheduled && scheduled.getTime() > now.getTime() ? scheduled : now;
    const publishStatus = publishStatusOnReady();
    const indexedAt = indexedAtOnReady({
      ...video,
      status: VideoStatus.READY,
      publishStatus,
      hlsUrl,
      thumbnailUrl,
      publishedAt,
    });

    await this.videoRepository.update(video.id, {
      status: VideoStatus.READY,
      publishStatus,
      hlsUrl,
      thumbnailUrl,
      muxAssetId: assetId,
      muxPlaybackId: playbackId,
      transcodeProvider: TranscodeProvider.MUX,
      durationSeconds: duration,
      publishedAt,
      indexedAt,
      failureReason: null,
    });

    await this.redis.del(videoDetailCacheKey(video.id));
    this.eventEmitter.emit('video.updated', { videoId: video.id });
    this.eventEmitter.emit('video.ready', {
      videoId: video.id,
      userId: video.userId,
      categoryId: video.categoryId ?? null,
      status: VideoStatus.READY,
      hlsUrl,
      thumbnailUrl,
    });

    const tracks = Array.isArray(data.tracks) ? data.tracks.length : 0;
    this.logger.log(
      JSON.stringify({
        msg: 'mux_vod_asset_ready',
        videoId: video.id,
        assetId,
        playbackId,
        duration,
        trackCount: tracks,
      }),
    );
    return true;
  }

  /** Best-effort cleanup when a video row is deleted or re-ingested. */
  async deleteAsset(assetId: string | null | undefined): Promise<void> {
    if (!assetId?.trim() || !this.isMuxConfigured()) return;
    try {
      await this.mux.video.assets.delete(assetId);
      this.logger.log(JSON.stringify({ msg: 'mux_vod_asset_deleted', assetId }));
    } catch (err) {
      this.logger.warn(
        `Mux asset delete failed for ${assetId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /** Handles `video.asset.errored` for VOD uploads. */
  async handleAssetErrored(payload: Record<string, unknown>): Promise<boolean> {
    const data = payload.data as Record<string, unknown> | undefined;
    if (!data) return false;

    const assetId = data.id as string | undefined;
    const passthrough = typeof data.passthrough === 'string' ? data.passthrough.trim() : '';
    const errors = data.errors as { type?: string; messages?: string[] } | undefined;
    const reason =
      errors?.messages?.join('; ')?.slice(0, 500) ||
      errors?.type ||
      'Mux transcoding failed';

    let video: Video | null = null;
    if (passthrough) {
      video = await this.videoRepository.findOne({ where: { id: passthrough } });
    }
    if (!video && assetId) {
      video = await this.videoRepository.findOne({ where: { muxAssetId: assetId } });
    }
    if (!video) return false;

    await this.videoRepository.update(video.id, {
      status: VideoStatus.FAILED,
      failureReason: reason,
    });
    await this.redis.del(videoDetailCacheKey(video.id));
    this.eventEmitter.emit('video.updated', { videoId: video.id });

    this.logger.warn(JSON.stringify({ msg: 'mux_vod_asset_errored', videoId: video.id, reason }));
    return true;
  }
}
