import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { CreatorStatus, User, UserRole } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { Video, VideoStatus } from '../content/entities/video.entity';
import { toPublicVideo, toPublicVideos } from '../content/video.mapper';
import { WatchHistory } from '../engagement/entities/watch-history.entity';

@Injectable()
export class UsersService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectRepository(WatchHistory)
    private readonly watchHistoryRepository: Repository<WatchHistory>,
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
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByUsername(username: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { username } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(requesterId: string, targetId: string, dto: UpdateUserDto): Promise<User> {
    if (requesterId !== targetId) throw new ForbiddenException('Cannot update another user\'s profile');
    const user = await this.findById(targetId);
    Object.assign(user, dto);
    return this.userRepository.save(user);
  }

  async getAvatarUploadUrl(requesterId: string, contentType: string, targetUserId: string) {
    if (requesterId !== targetUserId) {
      throw new ForbiddenException('Cannot upload avatar for another user');
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(contentType)) {
      throw new BadRequestException('Unsupported image format');
    }

    const ext = contentType.split('/')[1];
    const key = `avatars/${requesterId}/${uuidv4()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(this.s3, command, { expiresIn: 300 });
    const cdnDomain = this.configService.get<string>('aws.cloudfrontDomain');
    const publicUrl = cdnDomain ? `${cdnDomain}/${key}` : `https://${this.bucket}.s3.amazonaws.com/${key}`;

    await this.userRepository.update(requesterId, { avatarUrl: publicUrl });

    return { uploadUrl: url, publicUrl, key };
  }

  async getUserVideos(userId: string, limit = 20, cursor?: string) {
    const query = this.videoRepository
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.user', 'user')
      .leftJoinAndSelect('v.skillTags', 'skillTags')
      .where('v.userId = :userId', { userId })
      .andWhere('v.status = :status', { status: 'ready' })
      .orderBy('v.createdAt', 'DESC')
      .take(limit + 1);

    if (cursor) {
      const cursorDate = new Date(Buffer.from(cursor, 'base64').toString('utf-8'));
      query.andWhere('v.createdAt < :cursor', { cursor: cursorDate });
    }

    const videos = await query.getMany();
    const hasMore = videos.length > limit;
    const data = hasMore ? videos.slice(0, limit) : videos;
    const nextCursor =
      hasMore ? Buffer.from(data[data.length - 1].createdAt.toISOString()).toString('base64') : null;

    return { data: toPublicVideos(data), meta: { cursor: nextCursor, hasMore } };
  }

  async getWatchHistory(userId: string, limit = 20, incompleteOnly = false) {
    const take = Math.min(limit, 50);
    const qb = this.watchHistoryRepository
      .createQueryBuilder('wh')
      .leftJoinAndSelect('wh.video', 'video')
      .leftJoinAndSelect('video.user', 'user')
      .where('wh.userId = :userId', { userId })
      .orderBy('wh.watchedAt', 'DESC')
      .take(take);

    if (incompleteOnly) {
      qb.andWhere('video.durationSeconds IS NOT NULL');
      qb.andWhere('video.status = :ready', { ready: VideoStatus.READY });
      qb.andWhere('(wh.progressSeconds < (video.durationSeconds * 0.9))');
    }

    const rows = await qb.getMany();
    const ready = rows.filter((r) => r.video && r.video.status === VideoStatus.READY);
    if (incompleteOnly) {
      const videos = ready.map((r) => toPublicVideo(r.video as Video));
      return { data: videos, meta: { limit: take, incompleteOnly } };
    }
    const data = ready.map((r) => ({
      video: toPublicVideo(r.video as Video),
      progressSeconds: r.progressSeconds,
      watchedAt: r.watchedAt,
    }));
    return { data, meta: { limit: take, incompleteOnly } };
  }

  async requestCreator(userId: string, applicationNote?: string): Promise<User> {
    const user = await this.findById(userId);

    if (!user.isVerified) {
      throw new BadRequestException('Verify your email before applying to become a creator');
    }

    if (user.role === UserRole.ADMIN) return user;

    if (user.role === UserRole.CREATOR && user.creatorStatus === CreatorStatus.APPROVED) {
      return user;
    }

    user.role = UserRole.CREATOR;
    user.creatorStatus = CreatorStatus.PENDING;
    user.creatorRequestedAt = user.creatorRequestedAt ?? new Date();
    user.creatorReviewedAt = null;
    const note = applicationNote?.trim();
    user.creatorReviewNote = note || null;

    return this.userRepository.save(user);
  }
}
