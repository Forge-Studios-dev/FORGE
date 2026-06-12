import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { In, IsNull, Repository } from 'typeorm';
import { Like } from './entities/like.entity';
import { Comment } from './entities/comment.entity';
import { CommentLike } from './entities/comment-like.entity';
import { Follow } from './entities/follow.entity';
import { Video } from '../content/entities/video.entity';
import { User } from '../users/entities/user.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { toPublicComment } from './comment.mapper';
import { toPublicUser } from '../users/user.mapper';
import { UserRole } from '../users/entities/user.entity';

const COMMENT_RATE_LIMIT_SEC = 3;

@Injectable()
export class EngagementService {
  constructor(
    @InjectRepository(Like)
    private readonly likeRepository: Repository<Like>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(CommentLike)
    private readonly commentLikeRepository: Repository<CommentLike>,
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly eventEmitter: EventEmitter2,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async likeVideo(userId: string, videoId: string) {
    const video = await this.videoRepository.findOne({ where: { id: videoId } });
    if (!video) throw new NotFoundException('Video not found');

    const existing = await this.likeRepository.findOne({ where: { userId, videoId } });
    if (existing) throw new ConflictException('Already liked');

    const like = this.likeRepository.create({ userId, videoId });
    await this.likeRepository.save(like);
    await this.videoRepository.increment({ id: videoId }, 'likeCount', 1);

    this.eventEmitter.emit('video.liked', {
      videoId,
      videoOwnerId: video.userId,
      likerId: userId,
    });

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

  private async assertCommentRateLimit(userId: string, videoId: string): Promise<void> {
    const key = `comment:rate:${videoId}:${userId}`;
    const ok = await this.redis.set(key, '1', 'EX', COMMENT_RATE_LIMIT_SEC, 'NX');
    if (ok !== 'OK') {
      throw new BadRequestException('Please wait before posting another comment');
    }
  }

  async createComment(userId: string, videoId: string, dto: CreateCommentDto) {
    await this.assertCommentRateLimit(userId, videoId);

    const video = await this.videoRepository.findOne({ where: { id: videoId } });
    if (!video) throw new NotFoundException('Video not found');

    if (dto.parentId) {
      const parent = await this.commentRepository.findOne({
        where: { id: dto.parentId, videoId, deletedAt: IsNull() },
      });
      if (!parent) throw new NotFoundException('Parent comment not found');
      if (parent.parentId) {
        throw new BadRequestException('Replies are limited to one level of nesting');
      }
    }

    const comment = this.commentRepository.create({
      userId,
      videoId,
      content: dto.content,
      parentId: dto.parentId,
    });
    const saved = await this.commentRepository.save(comment);
    await this.videoRepository.increment({ id: videoId }, 'commentCount', 1);

    const full = await this.commentRepository.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });

    if (full) {
      this.eventEmitter.emit('comment.created', {
        videoId,
        comment: full,
        videoOwnerId: video.userId,
      });
      return toPublicComment(full);
    }

    throw new NotFoundException('Comment not found after create');
  }

  async getComments(videoId: string, limit = 20, cursor?: string, viewerId?: string) {
    const query = this.commentRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'user')
      .where('c.videoId = :videoId', { videoId })
      .andWhere('c.parentId IS NULL')
      .andWhere('c.deletedAt IS NULL')
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

    const total = await this.commentRepository.count({
      where: { videoId, parentId: IsNull(), deletedAt: IsNull() },
    });

    const likedIds = viewerId
      ? await this.getViewerLikedCommentIds(viewerId, data.map((c) => c.id))
      : new Set<string>();

    return {
      data: data.map((c) => toPublicComment(c, { viewerLiked: likedIds.has(c.id) })),
      meta: { cursor: nextCursor, hasMore, total },
    };
  }

  async getCommentReplies(
    videoId: string,
    commentId: string,
    limit = 20,
    cursor?: string,
    viewerId?: string,
  ) {
    const parent = await this.commentRepository.findOne({
      where: { id: commentId, videoId, deletedAt: IsNull() },
    });
    if (!parent) throw new NotFoundException('Comment not found');

    const query = this.commentRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'user')
      .where('c.parentId = :commentId', { commentId })
      .andWhere('c.deletedAt IS NULL')
      .orderBy('c.createdAt', 'ASC')
      .take(limit + 1);

    if (cursor) {
      const cursorDate = new Date(Buffer.from(cursor, 'base64').toString('utf-8'));
      query.andWhere('c.createdAt > :cursor', { cursor: cursorDate });
    }

    const replies = await query.getMany();
    const hasMore = replies.length > limit;
    const data = hasMore ? replies.slice(0, limit) : replies;
    const nextCursor = hasMore
      ? Buffer.from(data[data.length - 1].createdAt.toISOString()).toString('base64')
      : null;

    const likedIds = viewerId
      ? await this.getViewerLikedCommentIds(viewerId, data.map((c) => c.id))
      : new Set<string>();

    return {
      data: data.map((c) => toPublicComment(c, { viewerLiked: likedIds.has(c.id) })),
      meta: { cursor: nextCursor, hasMore },
    };
  }

  private async getViewerLikedCommentIds(
    viewerId: string,
    commentIds: string[],
  ): Promise<Set<string>> {
    if (!commentIds.length) return new Set();
    const rows = await this.commentLikeRepository.find({
      where: { userId: viewerId, commentId: In(commentIds) },
      select: ['commentId'],
    });
    return new Set(rows.map((r) => r.commentId));
  }

  async updateComment(
    userId: string,
    userRole: UserRole,
    videoId: string,
    commentId: string,
    dto: UpdateCommentDto,
  ) {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId, videoId, deletedAt: IsNull() },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Not allowed to edit this comment');
    }

    comment.content = dto.content;
    const saved = await this.commentRepository.save(comment);
    const full = await this.commentRepository.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });
    return full ? toPublicComment(full) : toPublicComment(saved);
  }

  async deleteComment(userId: string, userRole: UserRole, videoId: string, commentId: string) {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId, videoId, deletedAt: IsNull() },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Not allowed to delete this comment');
    }

    comment.deletedAt = new Date();
    comment.content = '[deleted]';
    await this.commentRepository.save(comment);
    await this.videoRepository.decrement({ id: videoId }, 'commentCount', 1);

    return { deleted: true };
  }

  async likeComment(userId: string, videoId: string, commentId: string) {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId, videoId, deletedAt: IsNull() },
    });
    if (!comment) throw new NotFoundException('Comment not found');

    const existing = await this.commentLikeRepository.findOne({ where: { userId, commentId } });
    if (existing) throw new ConflictException('Already liked');

    await this.commentLikeRepository.save(this.commentLikeRepository.create({ userId, commentId }));
    await this.commentRepository.increment({ id: commentId }, 'likeCount', 1);

    return { liked: true };
  }

  async unlikeComment(userId: string, videoId: string, commentId: string) {
    const like = await this.commentLikeRepository.findOne({ where: { userId, commentId } });
    if (!like) throw new NotFoundException('Like not found');

    await this.commentLikeRepository.remove(like);
    await this.commentRepository.decrement({ id: commentId }, 'likeCount', 1);

    return { liked: false };
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

    this.eventEmitter.emit('follow.created', { followerId, followingId });

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

  async getFollowers(userId: string, limit = 20, cursor?: string) {
    const query = this.followRepository
      .createQueryBuilder('f')
      .innerJoinAndSelect('f.follower', 'user')
      .where('f.followingId = :userId', { userId })
      .orderBy('f.createdAt', 'DESC')
      .take(limit + 1);

    if (cursor) {
      const cursorDate = new Date(Buffer.from(cursor, 'base64').toString('utf-8'));
      query.andWhere('f.createdAt < :cursor', { cursor: cursorDate });
    }

    const rows = await query.getMany();
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
      ? Buffer.from(page[page.length - 1].createdAt.toISOString()).toString('base64')
      : null;

    return {
      data: page.map((f) => toPublicUser(f.follower)),
      meta: { cursor: nextCursor, hasMore },
    };
  }

  async getFollowing(userId: string, limit = 20, cursor?: string) {
    const query = this.followRepository
      .createQueryBuilder('f')
      .innerJoinAndSelect('f.following', 'user')
      .where('f.followerId = :userId', { userId })
      .orderBy('f.createdAt', 'DESC')
      .take(limit + 1);

    if (cursor) {
      const cursorDate = new Date(Buffer.from(cursor, 'base64').toString('utf-8'));
      query.andWhere('f.createdAt < :cursor', { cursor: cursorDate });
    }

    const rows = await query.getMany();
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
      ? Buffer.from(page[page.length - 1].createdAt.toISOString()).toString('base64')
      : null;

    return {
      data: page.map((f) => toPublicUser(f.following)),
      meta: { cursor: nextCursor, hasMore },
    };
  }

  /** Batch follow lookup for entitlement checks (F-502). */
  async getFollowingIdsAmong(followerId: string, creatorIds: string[]): Promise<Set<string>> {
    const unique = [...new Set(creatorIds.filter(Boolean))];
    if (unique.length === 0) return new Set();
    const rows = await this.followRepository.find({
      where: { followerId, followingId: In(unique) },
      select: ['followingId'],
    });
    return new Set(rows.map((r) => r.followingId));
  }

  async getFollowingCreatorIds(followerId: string, limit = 500): Promise<string[]> {
    const rows = await this.followRepository.find({
      where: { followerId },
      select: ['followingId'],
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => r.followingId);
  }
}
