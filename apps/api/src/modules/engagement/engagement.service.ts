import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Like } from './entities/like.entity';
import { Comment } from './entities/comment.entity';
import { Follow } from './entities/follow.entity';
import { Video } from '../content/entities/video.entity';
import { User } from '../users/entities/user.entity';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class EngagementService {
  constructor(
    @InjectRepository(Like)
    private readonly likeRepository: Repository<Like>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async likeVideo(userId: string, videoId: string) {
    const video = await this.videoRepository.findOne({ where: { id: videoId } });
    if (!video) throw new NotFoundException('Video not found');

    const existing = await this.likeRepository.findOne({ where: { userId, videoId } });
    if (existing) throw new ConflictException('Already liked');

    const like = this.likeRepository.create({ userId, videoId });
    await this.likeRepository.save(like);
    await this.videoRepository.increment({ id: videoId }, 'likeCount', 1);

    return { liked: true };
  }

  async unlikeVideo(userId: string, videoId: string) {
    const like = await this.likeRepository.findOne({ where: { userId, videoId } });
    if (!like) throw new NotFoundException('Like not found');

    await this.likeRepository.remove(like);
    await this.videoRepository.decrement({ id: videoId }, 'likeCount', 1);

    return { liked: false };
  }

  async isLiked(userId: string, videoId: string): Promise<boolean> {
    const like = await this.likeRepository.findOne({ where: { userId, videoId } });
    return !!like;
  }

  async createComment(userId: string, videoId: string, dto: CreateCommentDto) {
    const video = await this.videoRepository.findOne({ where: { id: videoId } });
    if (!video) throw new NotFoundException('Video not found');

    if (dto.parentId) {
      const parent = await this.commentRepository.findOne({ where: { id: dto.parentId, videoId } });
      if (!parent) throw new NotFoundException('Parent comment not found');
    }

    const comment = this.commentRepository.create({
      userId,
      videoId,
      content: dto.content,
      parentId: dto.parentId,
    });
    const saved = await this.commentRepository.save(comment);
    await this.videoRepository.increment({ id: videoId }, 'commentCount', 1);

    return this.commentRepository.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });
  }

  async getComments(videoId: string, limit = 20, cursor?: string) {
    const query = this.commentRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'user')
      .where('c.videoId = :videoId', { videoId })
      .andWhere('c.parentId IS NULL')
      .orderBy('c.createdAt', 'DESC')
      .take(limit + 1);

    if (cursor) {
      const cursorDate = new Date(Buffer.from(cursor, 'base64').toString('utf-8'));
      query.andWhere('c.createdAt < :cursor', { cursor: cursorDate });
    }

    const comments = await query.getMany();
    const hasMore = comments.length > limit;
    const data = hasMore ? comments.slice(0, limit) : comments;
    const nextCursor = hasMore
      ? Buffer.from(data[data.length - 1].createdAt.toISOString()).toString('base64')
      : null;

    return { data, meta: { cursor: nextCursor, hasMore } };
  }

  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) throw new BadRequestException('Cannot follow yourself');

    const target = await this.userRepository.findOne({ where: { id: followingId } });
    if (!target) throw new NotFoundException('User not found');

    const existing = await this.followRepository.findOne({ where: { followerId, followingId } });
    if (existing) throw new ConflictException('Already following');

    await this.followRepository.save(this.followRepository.create({ followerId, followingId }));
    await this.userRepository.increment({ id: followerId }, 'followingCount', 1);
    await this.userRepository.increment({ id: followingId }, 'followerCount', 1);

    return { following: true };
  }

  async unfollow(followerId: string, followingId: string) {
    const follow = await this.followRepository.findOne({ where: { followerId, followingId } });
    if (!follow) throw new NotFoundException('Not following');

    await this.followRepository.remove(follow);
    await this.userRepository.decrement({ id: followerId }, 'followingCount', 1);
    await this.userRepository.decrement({ id: followingId }, 'followerCount', 1);

    return { following: false };
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const follow = await this.followRepository.findOne({ where: { followerId, followingId } });
    return !!follow;
  }
}
