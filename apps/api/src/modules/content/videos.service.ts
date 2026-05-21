import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import {
  Video,
  VideoStatus,
  VideoVisibility,
  ModerationStatus,
} from './entities/video.entity';
import { SkillTag } from '../categories/entities/skill-tag.entity';
import { WatchHistory } from '../engagement/entities/watch-history.entity';
import { Playlist } from '../playlists/entities/playlist.entity';
import { PlaylistVideo } from '../playlists/entities/playlist-video.entity';
import { CreateVideoDto } from './dto/create-video.dto';
import { PresignedUrlDto } from './dto/presigned-url.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { RecordWatchDto } from './dto/record-watch.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { PublicVideo, toPublicVideo } from './video.mapper';
import { rewriteMediaUrlToCdn } from '../../common/media-url.util';
import { videoDetailCacheKey } from './video-cache';

export const VIDEO_PROCESSING_QUEUE = 'video-processing';
export const VIDEO_PROCESSING_DLQ_QUEUE = 'video-processing-dlq';

const VIDEO_DETAIL_CACHE_TTL = 120;

@Injectable()
export class VideosService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly cdnDomain: string;

  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectRepository(SkillTag)
    private readonly skillTagRepository: Repository<SkillTag>,
    @InjectRepository(WatchHistory)
    private readonly watchHistoryRepository: Repository<WatchHistory>,
    @InjectRepository(Playlist)
    private readonly playlistRepository: Repository<Playlist>,
    @InjectRepository(PlaylistVideo)
    private readonly playlistVideoRepository: Repository<PlaylistVideo>,
    @InjectQueue(VIDEO_PROCESSING_QUEUE)
    private readonly videoQueue: Queue,
    @InjectRedis()
    private readonly redis: Redis,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.s3 = new S3Client({
      region: configService.get<string>('aws.region'),
      credentials: {
        accessKeyId: configService.get<string>('aws.accessKeyId') || '',
        secretAccessKey: configService.get<string>('aws.secretAccessKey') || '',
      },
    });
    this.bucket = configService.get<string>('aws.s3BucketName') || '';
    this.cdnDomain = configService.get<string>('aws.cloudfrontDomain') || '';
  }

  /** Presigned PUT URLs expire in 10 minutes — treat older incomplete rows as abandoned. */
  private static readonly PRESIGN_TTL_MS = 11 * 60 * 1000;
  /** Grace for an active browser PUT before the S3 object appears. */
  private static readonly ACTIVE_UPLOAD_GRACE_MS = 45 * 1000;
  /** S3 object present but /complete never called (smoke tests, failed publish). */
  private static readonly STUCK_INCOMPLETE_MS = 2 * 60 * 1000;

  assertCanWatchVideo(video: Video, viewerId?: string | null): void {
    const isOwner = !!viewerId && viewerId === video.userId;

    if (video.moderationStatus === ModerationStatus.BLOCKED && !isOwner) {
      throw new ForbiddenException('This video is not available');
    }
    if (video.moderationStatus === ModerationStatus.HELD && !isOwner) {
      throw new ForbiddenException('This video is not available');
    }
    if (video.visibility === VideoVisibility.PRIVATE && !isOwner) {
      throw new ForbiddenException('This video is private');
    }

    const now = new Date();
    if (video.scheduledPublishAt && video.scheduledPublishAt > now && !isOwner) {
      throw new ForbiddenException('This video is not published yet');
    }
    if (video.publishedAt && video.publishedAt > now && !isOwner) {
      throw new ForbiddenException('This video is not published yet');
    }
  }

  mapToPublicVideo(video: Video): PublicVideo {
    return toPublicVideo(video, {
      rewriteMediaUrl: (url) => this.rewritePlaybackUrl(url),
    });
  }

  rewritePlaybackUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    if (this.cdnDomain) return rewriteMediaUrlToCdn(url, this.cdnDomain);
    return url;
  }

  /** @deprecated use rewritePlaybackUrl */
  getSignedPlaybackUrl(hlsUrl: string): string {
    return this.rewritePlaybackUrl(hlsUrl) ?? hlsUrl;
  }

  private async s3ObjectExists(key: string): Promise<boolean> {
    try {
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  private async deleteS3Prefix(prefix: string): Promise<void> {
    let token: string | undefined;
    do {
      const list = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: token,
        }),
      );
      const keys = (list.Contents ?? []).map((o) => o.Key).filter((k): k is string => !!k);
      if (keys.length > 0) {
        await this.s3.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: keys.map((Key) => ({ Key })) },
          }),
        );
      }
      token = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (token);
  }

  private async deleteVideoAssets(video: Video): Promise<void> {
    if (video.s3Key) {
      await this.s3
        .send(new DeleteObjectCommand({ Bucket: this.bucket, Key: video.s3Key }))
        .catch(() => undefined);
    }
    await this.deleteS3Prefix(`videos/${video.id}/`);
    await this.deleteS3Prefix(`videos/${video.userId}/${video.id}/`);
  }

  private async removeUploadRow(row: Video): Promise<void> {
    await this.deleteVideoAssets(row);
    await this.bustVideoDetailCache(row.id);
    await this.videoRepository.remove(row);
  }

  /**
   * Clear ghost uploads: presign creates a DB row immediately; if the browser never
   * finishes PUT + /complete, the row must not block the next attempt.
   */
  private async releaseIncompleteUploads(userId: string): Promise<void> {
    const rows = await this.videoRepository.find({
      where: { userId, status: VideoStatus.UPLOADING },
    });
    const now = Date.now();
    for (const row of rows) {
      if (row.uploadCompletedAt) continue;
      const ageMs = now - row.createdAt.getTime();
      const hasS3 = row.s3Key ? await this.s3ObjectExists(row.s3Key) : false;
      const presignExpired = ageMs > VideosService.PRESIGN_TTL_MS;
      const neverUploaded = !hasS3 && ageMs > VideosService.ACTIVE_UPLOAD_GRACE_MS;
      const uploadedButNotFinished =
        hasS3 && ageMs > VideosService.STUCK_INCOMPLETE_MS;

      if (presignExpired || neverUploaded || uploadedButNotFinished) {
        await this.removeUploadRow(row);
      }
    }
  }

  /** All own videos for Studio (uploading, processing, ready, failed). */
  async listStudioVideos(userId: string, limit = 50) {
    await this.releaseIncompleteUploads(userId);
    const rows = await this.videoRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 100),
    });
    return { data: rows.map((v) => this.mapToPublicVideo(v)) };
  }

  /** Cancel or remove a non-published video (uploading, processing, failed). */
  async cancelUpload(userId: string, videoId: string): Promise<{ ok: true }> {
    const video = await this.findById(videoId, { skipCache: true });
    if (video.userId !== userId) throw new ForbiddenException();

    const cancellable = [
      VideoStatus.UPLOADING,
      VideoStatus.PROCESSING,
      VideoStatus.FAILED,
      VideoStatus.PENDING,
    ];
    if (!cancellable.includes(video.status)) {
      throw new BadRequestException(
        'Only uploading, processing, or failed videos can be cancelled',
      );
    }

    if (video.status === VideoStatus.PROCESSING) {
      const jobId = `video-process-${videoId}`;
      const job = await this.videoQueue.getJob(jobId);
      if (job) await job.remove().catch(() => undefined);
    }

    await this.deleteVideoAssets(video);
    await this.bustVideoDetailCache(videoId);
    this.eventEmitter.emit('video.updated', { videoId });
    await this.videoRepository.remove(video);
    return { ok: true };
  }

  /** Force-release every incomplete upload slot for this creator. */
  async releaseAllStuckUploads(userId: string): Promise<{ released: number }> {
    const rows = await this.videoRepository.find({
      where: { userId, status: VideoStatus.UPLOADING },
    });
    let released = 0;
    for (const row of rows) {
      if (!row.uploadCompletedAt) {
        await this.removeUploadRow(row);
        released += 1;
      }
    }
    return { released };
  }

  async getPresignedUploadUrl(userId: string, dto: PresignedUrlDto) {
    await this.releaseIncompleteUploads(userId);

    const uploadingCount = await this.videoRepository.count({
      where: { userId, status: VideoStatus.UPLOADING },
    });
    if (uploadingCount >= 1) {
      throw new BadRequestException(
        'An upload is still in progress. Wait a moment and try again, or cancel it from Studio → Videos.',
      );
    }

    const videoId = uuidv4();
    const ext = dto.contentType === 'video/quicktime' ? 'mov' : 'mp4';
    const key = `videos/${userId}/${videoId}/original.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: dto.contentType,
      ContentLength: dto.fileSizeBytes,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 600 });

    const video = this.videoRepository.create({
      id: videoId,
      userId,
      title: 'Untitled upload',
      description: null,
      status: VideoStatus.UPLOADING,
      visibility: VideoVisibility.PUBLIC,
      s3Key: key,
      uploadContentType: dto.contentType,
      uploadFileSizeBytes: dto.fileSizeBytes,
      uploadCompletedAt: null,
      failureReason: null,
    });
    await this.videoRepository.save(video);

    return { videoId, uploadUrl, key, expiresIn: 600 };
  }

  /**
   * Legacy endpoint behavior (kept for compatibility):
   * register + enqueue processing immediately.
   *
   * New flow should use: presigned-url -> S3 PUT -> /videos/:id/complete.
   */
  async create(userId: string, dto: CreateVideoDto): Promise<Video> {
    const skillTags = dto.skillTagIds?.length
      ? await this.skillTagRepository.find({ where: { id: In(dto.skillTagIds) } })
      : [];

    const video = this.videoRepository.create({
      userId,
      title: dto.title,
      description: dto.description,
      s3Key: dto.s3Key,
      visibility: dto.visibility,
      skillTags,
      status: VideoStatus.PENDING,
    });
    const saved = await this.videoRepository.save(video);

    await this.enqueueProcessJob(saved.id, dto.s3Key, userId);

    return saved;
  }

  async completeUpload(userId: string, videoId: string, dto: CompleteUploadDto) {
    const video = await this.videoRepository.findOne({
      where: { id: videoId },
      relations: ['skillTags'],
    });
    if (!video) throw new NotFoundException('Video not found');
    if (video.userId !== userId) throw new ForbiddenException();

    if (video.status !== VideoStatus.UPLOADING) {
      throw new BadRequestException('Video is not in uploading state');
    }

    if (!video.s3Key) throw new BadRequestException('Missing upload key');

    try {
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: video.s3Key }));
    } catch {
      throw new BadRequestException('Upload not found in storage');
    }

    let skillTags = dto.skillTagIds?.length
      ? await this.skillTagRepository.find({ where: { id: In(dto.skillTagIds) } })
      : [];

    if (dto.skillTagName?.trim() && skillTags.length === 0) {
      const byName = await this.skillTagRepository
        .createQueryBuilder('tag')
        .where('LOWER(tag.name) = LOWER(:name)', { name: dto.skillTagName.trim() })
        .getOne();
      if (byName) skillTags = [byName];
    }

    video.title = dto.title ?? video.title ?? 'Untitled upload';
    video.description = dto.description ?? video.description ?? null;
    if (dto.visibility) video.visibility = dto.visibility;
    if (dto.scheduledPublishAt) {
      const scheduled = new Date(dto.scheduledPublishAt);
      if (Number.isNaN(scheduled.getTime())) {
        throw new BadRequestException('Invalid scheduled publish time');
      }
      if (scheduled.getTime() <= Date.now() + 14 * 60 * 1000) {
        throw new BadRequestException('Schedule must be at least 15 minutes in the future');
      }
      video.scheduledPublishAt = scheduled;
    } else {
      video.scheduledPublishAt = null;
    }
    if (skillTags.length > 0) video.skillTags = skillTags;

    video.status = VideoStatus.PROCESSING;
    video.uploadCompletedAt = new Date();
    video.failureReason = null;

    const saved = await this.videoRepository.save(video);

    if (dto.playlistIds?.length) {
      await this.addVideoToPlaylists(userId, saved.id, dto.playlistIds);
    }

    await this.enqueueProcessJob(saved.id, saved.s3Key!, userId);

    return saved;
  }

  private async addVideoToPlaylists(
    userId: string,
    videoId: string,
    playlistIds: string[],
  ): Promise<void> {
    const unique = [...new Set(playlistIds)];
    const playlists = await this.playlistRepository.find({
      where: { id: In(unique), userId },
    });
    if (playlists.length !== unique.length) {
      throw new BadRequestException('One or more playlists were not found');
    }
    for (const playlist of playlists) {
      const existing = await this.playlistVideoRepository.findOne({
        where: { playlistId: playlist.id, videoId },
      });
      if (!existing) {
        await this.playlistVideoRepository.save(
          this.playlistVideoRepository.create({ playlistId: playlist.id, videoId }),
        );
      }
    }
  }

  async findById(id: string, opts?: { skipCache?: boolean }): Promise<Video> {
    const cacheKey = videoDetailCacheKey(id);
    if (!opts?.skipCache) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return this.videoRepository.create(JSON.parse(cached) as Video);
      }
    }
    const video = await this.videoRepository.findOne({
      where: { id },
      relations: ['user', 'skillTags'],
    });
    if (!video) throw new NotFoundException('Video not found');
    if (!opts?.skipCache) {
      await this.redis.setex(cacheKey, VIDEO_DETAIL_CACHE_TTL, JSON.stringify(video));
    }
    return video;
  }

  async bustVideoDetailCache(videoId: string): Promise<void> {
    await this.redis.del(videoDetailCacheKey(videoId));
  }

  async getVideoForViewer(id: string, viewerId?: string | null): Promise<PublicVideo> {
    const video = await this.findById(id);
    this.assertCanWatchVideo(video, viewerId);
    if (video.status === VideoStatus.READY) {
      await this.incrementViewCount(id);
    }
    return this.mapToPublicVideo(video);
  }

  async delete(requesterId: string, videoId: string): Promise<void> {
    const video = await this.findById(videoId, { skipCache: true });
    if (video.userId !== requesterId) throw new ForbiddenException();

    await this.deleteVideoAssets(video);
    await this.bustVideoDetailCache(videoId);
    this.eventEmitter.emit('video.updated', { videoId });
    await this.videoRepository.remove(video);
  }

  async incrementViewCount(videoId: string): Promise<void> {
    await this.videoRepository.increment({ id: videoId }, 'viewCount', 1);
  }

  async recordWatch(userId: string, videoId: string, dto: RecordWatchDto) {
    const video = await this.findById(videoId);
    this.assertCanWatchVideo(video, userId);
    if (video.status !== VideoStatus.READY) {
      throw new BadRequestException('Video is not available');
    }
    const progressSeconds = dto.progressSeconds ?? 0;
    await this.watchHistoryRepository.upsert(
      {
        userId,
        videoId,
        progressSeconds,
        watchedAt: new Date(),
      },
      { conflictPaths: ['userId', 'videoId'] },
    );
    return { ok: true };
  }

  async updateVideo(requesterId: string, videoId: string, dto: UpdateVideoDto) {
    const video = await this.findById(videoId, { skipCache: true });
    if (video.userId !== requesterId) throw new ForbiddenException();
    if (dto.title !== undefined) video.title = dto.title;
    if (dto.description !== undefined) video.description = dto.description;
    if (dto.visibility !== undefined) video.visibility = dto.visibility;
    if (dto.scheduledPublishAt !== undefined) {
      if (dto.scheduledPublishAt === null) {
        video.scheduledPublishAt = null;
      } else {
        const scheduled = new Date(dto.scheduledPublishAt);
        if (Number.isNaN(scheduled.getTime())) {
          throw new BadRequestException('Invalid scheduled publish time');
        }
        video.scheduledPublishAt = scheduled;
      }
    }
    const saved = await this.videoRepository.save(video);
    await this.bustVideoDetailCache(videoId);
    this.eventEmitter.emit('video.updated', { videoId });
    return this.mapToPublicVideo(saved);
  }

  private enqueueProcessJob(videoId: string, s3Key: string, userId: string) {
    return this.videoQueue.add(
      'process-video',
      { videoId, s3Key, userId },
      {
        jobId: `video-process-${videoId}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnFail: { age: 7 * 24 * 3600 },
        removeOnComplete: { age: 24 * 3600, count: 500 },
      },
    );
  }
}
