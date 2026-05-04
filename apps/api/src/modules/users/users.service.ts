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
import { User } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { Video } from '../content/entities/video.entity';

@Injectable()
export class UsersService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
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

  async getAvatarUploadUrl(userId: string, contentType: string) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(contentType)) {
      throw new BadRequestException('Unsupported image format');
    }

    const ext = contentType.split('/')[1];
    const key = `avatars/${userId}/${uuidv4()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(this.s3, command, { expiresIn: 300 });
    const cdnDomain = this.configService.get<string>('aws.cloudfrontDomain');
    const publicUrl = cdnDomain ? `${cdnDomain}/${key}` : `https://${this.bucket}.s3.amazonaws.com/${key}`;

    await this.userRepository.update(userId, { avatarUrl: publicUrl });

    return { uploadUrl: url, publicUrl, key };
  }

  async getUserVideos(userId: string, limit = 20, cursor?: string) {
    const query = this.videoRepository
      .createQueryBuilder('v')
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

    return { data, meta: { cursor: nextCursor, hasMore } };
  }
}
