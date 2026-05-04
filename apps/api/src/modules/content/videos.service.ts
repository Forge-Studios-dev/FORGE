import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { Video, VideoStatus } from './entities/video.entity';
import { SkillTag } from '../categories/entities/skill-tag.entity';
import { CreateVideoDto } from './dto/create-video.dto';
import { PresignedUrlDto } from './dto/presigned-url.dto';

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
    const ext = dto.contentType.split('/')[1] === 'quicktime' ? 'mov' : dto.contentType.split('/')[1];
    const key = `raw-uploads/${userId}/${uuidv4()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: dto.contentType,
      ContentLength: dto.fileSizeBytes,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 3600 });
    return { uploadUrl, key, expiresIn: 3600 };
  }

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
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
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
