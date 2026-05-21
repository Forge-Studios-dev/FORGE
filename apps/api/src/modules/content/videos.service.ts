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
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { Video, VideoStatus } from './entities/video.entity';
import { SkillTag } from '../categories/entities/skill-tag.entity';
import { WatchHistory } from '../engagement/entities/watch-history.entity';
import { CreateVideoDto } from './dto/create-video.dto';
import { PresignedUrlDto } from './dto/presigned-url.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { RecordWatchDto } from './dto/record-watch.dto';
import { UpdateVideoDto } from './dto/update-video.dto';

export const VIDEO_PROCESSING_QUEUE = 'video-processing';
export const VIDEO_PROCESSING_DLQ_QUEUE = 'video-processing-dlq';

const VIDEO_DETAIL_CACHE_PREFIX = 'video:detail:';
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

  /** Drop abandoned presign rows so a failed browser upload does not block forever. */
  private async abandonStaleUploads(userId: string) {
    const staleBefore = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const stale = await this.videoRepository.find({
      where: { userId, status: VideoStatus.UPLOADING },
    });
    for (const row of stale) {
      if (!row.uploadCompletedAt && row.createdAt < staleBefore) {
        if (row.s3Key) {
          await this.s3
            .send(new DeleteObjectCommand({ Bucket: this.bucket, Key: row.s3Key }))
            .catch(() => undefined);
        }
        await this.videoRepository.remove(row);
      }
    }
  }

  async getPresignedUploadUrl(userId: string, dto: PresignedUrlDto) {
    await this.abandonStaleUploads(userId);

    const uploadingCount = await this.videoRepository.count({
      where: { userId, status: VideoStatus.UPLOADING },
    });
    if (uploadingCount >= 1) {
      throw new BadRequestException(
        'Another upload is already in progress. Finish it, or cancel it from Studio → Videos.',
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
      visibility: undefined,
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
    if (skillTags.length > 0) video.skillTags = skillTags;

    video.status = VideoStatus.PROCESSING;
    video.uploadCompletedAt = new Date();
    video.failureReason = null;

    const saved = await this.videoRepository.save(video);

    await this.enqueueProcessJob(saved.id, saved.s3Key!, userId);

    return saved;
  }

  async findById(id: string, opts?: { skipCache?: boolean }): Promise<Video> {
    const cacheKey = `${VIDEO_DETAIL_CACHE_PREFIX}${id}`;
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

  private async bustVideoDetailCache(videoId: string) {
    await this.redis.del(`${VIDEO_DETAIL_CACHE_PREFIX}${videoId}`);
  }

  async delete(requesterId: string, videoId: string): Promise<void> {
    const video = await this.findById(videoId, { skipCache: true });
    if (video.userId !== requesterId) throw new ForbiddenException();

    if (video.s3Key) {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: video.s3Key }));
    }

    await this.bustVideoDetailCache(videoId);
    this.eventEmitter.emit('video.updated', { videoId });
    await this.videoRepository.remove(video);
  }

  async incrementViewCount(videoId: string): Promise<void> {
    await this.videoRepository.increment({ id: videoId }, 'viewCount', 1);
  }

  getSignedPlaybackUrl(hlsUrl: string): string {
    if (this.cdnDomain && hlsUrl) {
      return hlsUrl.replace(/^https?:\/\/[^/]+/, this.cdnDomain);
    }
    return hlsUrl;
  }

  async recordWatch(userId: string, videoId: string, dto: RecordWatchDto) {
    const video = await this.findById(videoId);
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
      video.scheduledPublishAt = dto.scheduledPublishAt ? new Date(dto.scheduledPublishAt) : null;
    }
    const saved = await this.videoRepository.save(video);
    await this.bustVideoDetailCache(videoId);
    this.eventEmitter.emit('video.updated', { videoId });
    return saved;
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
