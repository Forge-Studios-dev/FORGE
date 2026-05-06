import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { Video, VideoStatus } from './entities/video.entity';
import { SkillTag } from '../categories/entities/skill-tag.entity';
import { CreateVideoDto } from './dto/create-video.dto';
import { PresignedUrlDto } from './dto/presigned-url.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';

export const VIDEO_PROCESSING_QUEUE = 'video-processing';

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
    @InjectQueue(VIDEO_PROCESSING_QUEUE)
    private readonly videoQueue: Queue,
    private readonly configService: ConfigService,
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

  async getPresignedUploadUrl(userId: string, dto: PresignedUrlDto) {
    const uploadingCount = await this.videoRepository.count({
      where: { userId, status: VideoStatus.UPLOADING },
    });
    if (uploadingCount >= 1) {
      throw new BadRequestException('Another upload is already in progress');
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

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 3600 });

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

    return { videoId, uploadUrl, key, expiresIn: 3600 };
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

    await this.videoQueue.add(
      'process-video',
      { videoId: saved.id, s3Key: dto.s3Key, userId },
      { attempts: 5, backoff: { type: 'exponential', delay: 5000 } },
    );

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

    const skillTags = dto.skillTagIds?.length
      ? await this.skillTagRepository.find({ where: { id: In(dto.skillTagIds) } })
      : [];

    video.title = dto.title ?? video.title ?? 'Untitled upload';
    video.description = dto.description ?? video.description ?? null;
    if (dto.visibility) video.visibility = dto.visibility;
    if (dto.skillTagIds) video.skillTags = skillTags;

    video.status = VideoStatus.PROCESSING;
    video.uploadCompletedAt = new Date();
    video.failureReason = null;

    const saved = await this.videoRepository.save(video);

    await this.videoQueue.add(
      'process-video',
      { videoId: saved.id, s3Key: saved.s3Key, userId },
      { attempts: 5, backoff: { type: 'exponential', delay: 5000 } },
    );

    return saved;
  }

  async findById(id: string): Promise<Video> {
    const video = await this.videoRepository.findOne({
      where: { id },
      relations: ['user', 'skillTags'],
    });
    if (!video) throw new NotFoundException('Video not found');
    return video;
  }

  async delete(requesterId: string, videoId: string): Promise<void> {
    const video = await this.findById(videoId);
    if (video.userId !== requesterId) throw new ForbiddenException();

    if (video.s3Key) {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: video.s3Key }));
    }

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
}
