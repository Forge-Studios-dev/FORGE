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
  ModerationStatus,
} from './entities/video.entity';
import { createS3Client } from '../../common/create-s3-client';
import { indexedAtOnReady, publishStatusOnReady } from './video-publish.util';
import { videoDetailCacheKey } from './video-cache';
import { muxHlsPlaybackUrl, muxThumbnailUrl, muxCaptionVttUrl } from './mux-vod.constants';
import { resolveVideoTypeOnReady } from './short-duration.util';
import { ContentScanService } from './content-scan/content-scan.service';
import { ScheduledPublishScheduler } from './scheduled-publish.scheduler';
import { requiresMuxSignedPlayback } from '../../common/media/mux-signing.util';

export interface MuxVodIngestJob {
  videoId: string;
  s3Key: string;
  userId: string;
}

type MuxTrackLike = {
  id?: string;
  type?: string;
  text_type?: string;
  status?: string;
  language_code?: string;
  name?: string;
};

function pickCaptionTrackId(tracks: unknown): string | null {
  if (!Array.isArray(tracks)) return null;
  for (const raw of tracks) {
    const track = raw as MuxTrackLike;
    if (track.type !== 'text') continue;
    if (track.text_type && track.text_type !== 'subtitles' && track.text_type !== 'captions') {
      continue;
    }
    if (track.status && track.status !== 'ready') continue;
    if (typeof track.id === 'string' && track.id.length > 0) return track.id;
  }
  return null;
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
    @InjectRedis()
    private readonly redis: Redis,
    private readonly contentScanService: ContentScanService,
    private readonly scheduledPublishScheduler: ScheduledPublishScheduler,
  ) {
    this.s3 = createS3Client({
      region: configService.get<string>('aws.region') || 'ap-south-1',
      accessKeyId: configService.get<string>('aws.accessKeyId') || '',
      secretAccessKey: configService.get<string>('aws.secretAccessKey') || '',
      roleArn: configService.get<string>('aws.roleArn') || undefined,
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

    const useSignedPlayback = requiresMuxSignedPlayback(video.visibility);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await this.mux.video.assets.create({
      inputs: [
        {
          url: signedUrl,
          generated_subtitles: [
            {
              language_code:
                this.configService.get<string>('video.autoCaptionLanguage') || 'en',
              name: this.configService.get<string>('video.autoCaptionName') || 'English CC',
            },
          ],
        },
      ],
      playback_policy: [useSignedPlayback ? 'signed' : 'public'],
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

    const typeResolution = resolveVideoTypeOnReady(video.videoType, duration);
    if (!typeResolution.ok) {
      await this.videoRepository.update(video.id, {
        status: VideoStatus.FAILED,
        durationSeconds: duration,
        muxAssetId: assetId,
        muxPlaybackId: playbackId,
        transcodeProvider: TranscodeProvider.MUX,
        failureReason: typeResolution.reason,
      });
      await this.redis.del(videoDetailCacheKey(video.id));
      this.eventEmitter.emit('video.updated', { videoId: video.id });
      this.logger.warn(
        JSON.stringify({
          msg: 'mux_vod_short_too_long',
          videoId: video.id,
          assetId,
          duration,
          reason: typeResolution.reason,
        }),
      );
      return true;
    }

    const hlsUrl = muxHlsPlaybackUrl(playbackId);
    const thumbnailUrl = muxThumbnailUrl(playbackId);
    const captionTrackId = pickCaptionTrackId(data.tracks);
    const captionUrl = captionTrackId ? muxCaptionVttUrl(playbackId, captionTrackId) : null;
    const now = new Date();
    const scheduled = video.scheduledPublishAt;
    const publishedAt =
      scheduled && scheduled.getTime() > now.getTime() ? scheduled : now;
    const publishStatus = publishStatusOnReady();

    const scanVerdict = await this.contentScanService.scanVideo({
      videoId: video.id,
      userId: video.userId,
      hlsUrl,
      thumbnailUrl,
    });
    const moderationStatus =
      scanVerdict.action === 'block'
        ? ModerationStatus.BLOCKED
        : scanVerdict.action === 'hold'
          ? ModerationStatus.HELD
          : ModerationStatus.NONE;

    const indexedAt = indexedAtOnReady({
      ...video,
      status: VideoStatus.READY,
      publishStatus,
      hlsUrl,
      thumbnailUrl,
      publishedAt,
      moderationStatus,
    });

    await this.videoRepository.update(video.id, {
      status: VideoStatus.READY,
      publishStatus,
      hlsUrl,
      thumbnailUrl,
      ...(captionUrl
        ? {
            captionUrl,
            captionTracks: [{ language: 'en', label: 'English', url: captionUrl }],
          }
        : {}),
      muxAssetId: assetId,
      muxPlaybackId: playbackId,
      transcodeProvider: TranscodeProvider.MUX,
      durationSeconds: duration,
      videoType: typeResolution.videoType,
      publishedAt,
      indexedAt,
      failureReason: null,
      moderationStatus,
      ...(moderationStatus !== ModerationStatus.NONE
        ? {
            moderationNote: `content_scan:${scanVerdict.provider}:${scanVerdict.categories.join('|') || 'unspecified'}`,
            moderatedAt: now,
          }
        : {}),
    });

    await this.redis.del(videoDetailCacheKey(video.id));
    if (scheduled && scheduled.getTime() > now.getTime() && !indexedAt) {
      await this.scheduledPublishScheduler.schedulePublish(video.id, scheduled);
    }
    this.eventEmitter.emit('video.updated', { videoId: video.id });
    if (moderationStatus === ModerationStatus.NONE) {
      this.eventEmitter.emit('video.ready', {
        videoId: video.id,
        userId: video.userId,
        categoryId: video.categoryId ?? null,
        videoType: video.videoType,
        status: VideoStatus.READY,
        hlsUrl,
        thumbnailUrl,
      });
    } else {
      this.eventEmitter.emit('video.content_scan_held', {
        videoId: video.id,
        userId: video.userId,
        moderationStatus,
        categories: scanVerdict.categories,
        provider: scanVerdict.provider,
      });
    }

    const tracks = Array.isArray(data.tracks) ? data.tracks.length : 0;
    this.logger.log(
      JSON.stringify({
        msg: 'mux_vod_asset_ready',
        videoId: video.id,
        assetId,
        playbackId,
        duration,
        videoType: typeResolution.videoType,
        trackCount: tracks,
        captionUrl: captionUrl ?? undefined,
      }),
    );
    return true;
  }

  /**
   * Handles `video.asset.track.ready` — auto-generated captions often arrive
   * after `video.asset.ready`.
   */
  async handleTrackReady(payload: Record<string, unknown>): Promise<boolean> {
    const data = payload.data as Record<string, unknown> | undefined;
    if (!data) return false;

    const track = data as MuxTrackLike & { asset_id?: string };
    if (track.type !== 'text') return false;
    if (track.text_type && track.text_type !== 'subtitles' && track.text_type !== 'captions') {
      return false;
    }
    const trackId = typeof track.id === 'string' ? track.id : '';
    const assetId = typeof track.asset_id === 'string' ? track.asset_id : '';
    if (!trackId || !assetId) return false;

    const video = await this.videoRepository.findOne({ where: { muxAssetId: assetId } });
    if (!video?.muxPlaybackId) return false;

    const captionUrl = muxCaptionVttUrl(video.muxPlaybackId, trackId);
    if (video.captionUrl === captionUrl) return true;

    const lang =
      typeof track.language_code === 'string' && track.language_code
        ? track.language_code.slice(0, 8).toLowerCase()
        : 'en';
    const label = typeof track.name === 'string' && track.name ? track.name : 'English';
    const existing = [...(video.captionTracks ?? [])];
    const nextTrack = { language: lang, label, url: captionUrl };
    const idx = existing.findIndex((t) => t.language === lang);
    if (idx >= 0) existing[idx] = nextTrack;
    else existing.push(nextTrack);

    await this.videoRepository.update(video.id, {
      captionUrl,
      captionTracks: existing,
    });
    await this.redis.del(videoDetailCacheKey(video.id));
    this.eventEmitter.emit('video.updated', { videoId: video.id });
    this.eventEmitter.emit('video.captions.updated', { videoId: video.id });

    this.logger.log(
      JSON.stringify({
        msg: 'mux_vod_caption_ready',
        videoId: video.id,
        assetId,
        trackId,
        captionUrl,
        language: lang,
      }),
    );
    return true;
  }

  /**
   * Re-issues the Mux playback id when a video's visibility crosses the
   * public/signed boundary post-publish. The original ingest-time policy is
   * otherwise permanent — a video switched from public to private/tier/etc.
   * would keep serving unauthenticated playback at its old playback id.
   * Mutates `video` in place (caller persists); throws only when the new,
   * correctly-scoped playback id could not be created.
   */
  async syncPlaybackPolicy(video: Video): Promise<void> {
    if (!video.muxAssetId || !video.muxPlaybackId || !this.isMuxConfigured()) return;

    const desiredPolicy = requiresMuxSignedPlayback(video.visibility) ? 'signed' : 'public';
    const oldPlaybackId = video.muxPlaybackId;

    let created: { id?: string };
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      created = (await this.mux.video.assets.createPlaybackId(video.muxAssetId, {
        policy: desiredPolicy,
      } as any)) as any;
    } catch (err) {
      this.logger.error(
        `Mux playback policy sync failed for video ${video.id}: ${err instanceof Error ? err.message : err}`,
      );
      throw new ServiceUnavailableException('Could not update video access policy — please retry');
    }

    const newPlaybackId = created?.id;
    if (!newPlaybackId) {
      throw new ServiceUnavailableException('Could not update video access policy — please retry');
    }

    video.muxPlaybackId = newPlaybackId;
    video.hlsUrl = muxHlsPlaybackUrl(newPlaybackId);
    video.thumbnailUrl = muxThumbnailUrl(newPlaybackId);
    if (video.captionTracks?.length) {
      video.captionTracks = video.captionTracks.map((t) => ({
        ...t,
        url: t.url.replace(oldPlaybackId, newPlaybackId),
      }));
    }
    if (video.captionUrl) {
      video.captionUrl = video.captionUrl.replace(oldPlaybackId, newPlaybackId);
    }

    try {
      await this.mux.video.assets.deletePlaybackId(video.muxAssetId, oldPlaybackId);
    } catch (err) {
      // The new, correctly-scoped id is already live and saved by the caller —
      // this only means the stale id lingers on Mux's side until cleaned up.
      this.logger.error(
        JSON.stringify({
          msg: 'mux_vod_old_playback_id_delete_failed',
          videoId: video.id,
          assetId: video.muxAssetId,
          staleId: oldPlaybackId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }

    this.logger.log(
      JSON.stringify({
        msg: 'mux_vod_playback_policy_synced',
        videoId: video.id,
        assetId: video.muxAssetId,
        policy: desiredPolicy,
      }),
    );
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
