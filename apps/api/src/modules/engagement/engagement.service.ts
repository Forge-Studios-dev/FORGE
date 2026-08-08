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
import { Like, VideoReactionType } from './entities/like.entity';
import { Comment } from './entities/comment.entity';
import { CommentLike, CommentReactionType } from './entities/comment-like.entity';
import { Follow, FollowNotifyLevel } from './entities/follow.entity';
import { Video } from '../content/entities/video.entity';
import { User } from '../users/entities/user.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { toPublicComment } from './comment.mapper';
import { toPublicVideo } from '../content/video.mapper';
import { toPublicUser } from '../users/user.mapper';
import { UserRole } from '../users/entities/user.entity';
import {
  getMutedChannelIds,
  unmuteChannel,
} from '../feed/not-interested.util';

const COMMENT_RATE_LIMIT_SEC = 3;
/** Cap for Disliked videos shelf (YouTube-style private list). */
const DISLIKED_LIST_LIMIT = 200;

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
    return this.setVideoReaction(userId, videoId, VideoReactionType.LIKE);
  }

  async unlikeVideo(userId: string, videoId: string) {
    return this.clearVideoReaction(userId, videoId, VideoReactionType.LIKE);
  }

  async dislikeVideo(userId: string, videoId: string) {
    return this.setVideoReaction(userId, videoId, VideoReactionType.DISLIKE);
  }

  async undislikeVideo(userId: string, videoId: string) {
    return this.clearVideoReaction(userId, videoId, VideoReactionType.DISLIKE);
  }

  /** Private Disliked videos shelf (Library → Disliked videos). */
  async listDislikedVideos(userId: string, limit = 50) {
    const take = Math.min(Math.max(Number(limit) || 50, 1), DISLIKED_LIST_LIMIT);
    const dislikes = await this.likeRepository.find({
      where: { userId, reaction: VideoReactionType.DISLIKE },
      order: { createdAt: 'DESC' },
      take,
    });
    const videoIds = dislikes.map((d) => d.videoId);
    const videos =
      videoIds.length === 0
        ? []
        : await this.videoRepository.find({
            where: { id: In(videoIds) },
            relations: ['user', 'skillTags'],
          });
    const byId = new Map(videos.map((v) => [v.id, v]));
    const data = dislikes
      .map((row) => {
        const video = byId.get(row.videoId);
        if (!video) return null;
        return {
          ...toPublicVideo(video),
          viewerDisliked: true as const,
          dislikedAt: row.createdAt,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);

    const total = await this.likeRepository.count({
      where: { userId, reaction: VideoReactionType.DISLIKE },
    });

    return { data, meta: { total, limit: take } };
  }

  /** Clear recent Disliked shelf (batched; keeps dislikeCount in sync). */
  async clearDislikedVideos(userId: string) {
    const dislikes = await this.likeRepository.find({
      where: { userId, reaction: VideoReactionType.DISLIKE },
      order: { createdAt: 'DESC' },
      take: DISLIKED_LIST_LIMIT,
    });
    for (const row of dislikes) {
      await this.likeRepository.remove(row);
      await this.videoRepository.decrement({ id: row.videoId }, 'dislikeCount', 1);
    }
    return { ok: true, cleared: dislikes.length };
  }

  private async setVideoReaction(
    userId: string,
    videoId: string,
    reaction: VideoReactionType,
  ) {
    const video = await this.videoRepository.findOne({ where: { id: videoId } });
    if (!video) throw new NotFoundException('Video not found');

    const existing = await this.likeRepository.findOne({ where: { userId, videoId } });
    if (existing?.reaction === reaction) {
      return reaction === VideoReactionType.LIKE
        ? { liked: true, disliked: false }
        : { liked: false, disliked: true };
    }

    if (existing) {
      const prev = existing.reaction;
      existing.reaction = reaction;
      await this.likeRepository.save(existing);
      if (prev === VideoReactionType.LIKE) {
        await this.videoRepository.decrement({ id: videoId }, 'likeCount', 1);
      } else {
        await this.videoRepository.decrement({ id: videoId }, 'dislikeCount', 1);
      }
      if (reaction === VideoReactionType.LIKE) {
        await this.videoRepository.increment({ id: videoId }, 'likeCount', 1);
        this.eventEmitter.emit('video.liked', {
          videoId,
          videoOwnerId: video.userId,
          likerId: userId,
        });
      } else {
        await this.videoRepository.increment({ id: videoId }, 'dislikeCount', 1);
      }
    } else {
      const row = this.likeRepository.create({ userId, videoId, reaction });
      await this.likeRepository.save(row);
      if (reaction === VideoReactionType.LIKE) {
        await this.videoRepository.increment({ id: videoId }, 'likeCount', 1);
        this.eventEmitter.emit('video.liked', {
          videoId,
          videoOwnerId: video.userId,
          likerId: userId,
        });
      } else {
        await this.videoRepository.increment({ id: videoId }, 'dislikeCount', 1);
      }
    }

    return reaction === VideoReactionType.LIKE
      ? { liked: true, disliked: false }
      : { liked: false, disliked: true };
  }

  private async clearVideoReaction(
    userId: string,
    videoId: string,
    expected?: VideoReactionType,
  ) {
    const like = await this.likeRepository.findOne({ where: { userId, videoId } });
    if (!like) {
      return { liked: false, disliked: false };
    }
    if (expected && like.reaction !== expected) {
      return like.reaction === VideoReactionType.LIKE
        ? { liked: true, disliked: false }
        : { liked: false, disliked: true };
    }

    const prev = like.reaction;
    await this.likeRepository.remove(like);
    if (prev === VideoReactionType.LIKE) {
      await this.videoRepository.decrement({ id: videoId }, 'likeCount', 1);
    } else {
      await this.videoRepository.decrement({ id: videoId }, 'dislikeCount', 1);
    }
    return { liked: false, disliked: false };
  }

  async isLiked(userId: string, videoId: string): Promise<boolean> {
    const like = await this.likeRepository.findOne({
      where: { userId, videoId, reaction: VideoReactionType.LIKE },
    });
    return !!like;
  }

  async isDisliked(userId: string, videoId: string): Promise<boolean> {
    const like = await this.likeRepository.findOne({
      where: { userId, videoId, reaction: VideoReactionType.DISLIKE },
    });
    return !!like;
  }

  async getViewerVideoReaction(
    userId: string,
    videoId: string,
  ): Promise<{ viewerLiked: boolean; viewerDisliked: boolean }> {
    const row = await this.likeRepository.findOne({ where: { userId, videoId } });
    return {
      viewerLiked: row?.reaction === VideoReactionType.LIKE,
      viewerDisliked: row?.reaction === VideoReactionType.DISLIKE,
    };
  }

  /** Batch reactions for a feed page (one query). */
  async getViewerVideoReactions(
    userId: string,
    videoIds: string[],
  ): Promise<Map<string, { viewerLiked: boolean; viewerDisliked: boolean }>> {
    const out = new Map<string, { viewerLiked: boolean; viewerDisliked: boolean }>();
    for (const id of videoIds) {
      out.set(id, { viewerLiked: false, viewerDisliked: false });
    }
    if (videoIds.length === 0) return out;

    const rows = await this.likeRepository.find({
      where: { userId, videoId: In(videoIds) },
      select: ['videoId', 'reaction'],
    });
    for (const row of rows) {
      out.set(row.videoId, {
        viewerLiked: row.reaction === VideoReactionType.LIKE,
        viewerDisliked: row.reaction === VideoReactionType.DISLIKE,
      });
    }
    return out;
  }

  /** Batch follow checks for a set of channel IDs (one query). */
  async getFollowingSet(followerId: string, followingIds: string[]): Promise<Set<string>> {
    if (followingIds.length === 0) return new Set();
    const rows = await this.followRepository.find({
      where: { followerId, followingId: In(followingIds) },
      select: ['followingId'],
    });
    return new Set(rows.map((r) => r.followingId));
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

  async getComments(
    videoId: string,
    limit = 20,
    cursor?: string,
    viewerId?: string,
    sort: 'newest' | 'top' | 'oldest' = 'newest',
  ) {
    const query = this.commentRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'user')
      .where('c.videoId = :videoId', { videoId })
      .andWhere('c.parentId IS NULL')
      .andWhere('c.deletedAt IS NULL')
      .take(limit + 1);

    // Pinned comment stays at top of the first page only.
    if (cursor) {
      query.andWhere('c.isPinned = false');
    }

    if (sort === 'top') {
      query
        .orderBy('c.isPinned', 'DESC')
        .addOrderBy('c.likeCount', 'DESC')
        .addOrderBy('c.createdAt', 'DESC');
      if (cursor) {
        try {
          const parsed = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8')) as {
            likeCount?: number;
            createdAt?: string;
          };
          const likeCount = Number(parsed.likeCount);
          const createdAt = parsed.createdAt ? new Date(parsed.createdAt) : null;
          if (Number.isFinite(likeCount) && createdAt && !Number.isNaN(createdAt.getTime())) {
            query.andWhere(
              '(c.likeCount < :likeCount OR (c.likeCount = :likeCount AND c.createdAt < :createdAt))',
              { likeCount, createdAt },
            );
          }
        } catch {
          /* ignore bad cursor */
        }
      }
    } else if (sort === 'oldest') {
      query.orderBy('c.isPinned', 'DESC').addOrderBy('c.createdAt', 'ASC');
      if (cursor) {
        const cursorDate = new Date(Buffer.from(cursor, 'base64').toString('utf-8'));
        if (!Number.isNaN(cursorDate.getTime())) {
          query.andWhere('c.createdAt > :cursor', { cursor: cursorDate });
        }
      }
    } else {
      query.orderBy('c.isPinned', 'DESC').addOrderBy('c.createdAt', 'DESC');
      if (cursor) {
        const cursorDate = new Date(Buffer.from(cursor, 'base64').toString('utf-8'));
        if (!Number.isNaN(cursorDate.getTime())) {
          query.andWhere('c.createdAt < :cursor', { cursor: cursorDate });
        }
      }
    }

    const comments = await query.getMany();
    const hasMore = comments.length > limit;
    const data = hasMore ? comments.slice(0, limit) : comments;
    const last = data[data.length - 1];
    const nextCursor = hasMore && last
      ? sort === 'top'
        ? Buffer.from(
            JSON.stringify({
              likeCount: last.likeCount,
              createdAt: last.createdAt.toISOString(),
            }),
          ).toString('base64')
        : Buffer.from(last.createdAt.toISOString()).toString('base64')
      : null;

    const total = await this.commentRepository.count({
      where: { videoId, parentId: IsNull(), deletedAt: IsNull() },
    });

    const likedIds = viewerId
      ? await this.getViewerLikedCommentIds(viewerId, data.map((c) => c.id))
      : new Set<string>();
    const dislikedIds = viewerId
      ? await this.getViewerDislikedCommentIds(viewerId, data.map((c) => c.id))
      : new Set<string>();

    const replyCounts = await this.getReplyCounts(data.map((c) => c.id));

    return {
      data: data.map((c) =>
        toPublicComment(c, {
          viewerLiked: likedIds.has(c.id),
          viewerDisliked: dislikedIds.has(c.id),
          replyCount: replyCounts.get(c.id) ?? 0,
        }),
      ),
      meta: { cursor: nextCursor, hasMore, total, sort },
    };
  }

  /** Single comment for deep links (`?lc=`). */
  async getComment(videoId: string, commentId: string, viewerId?: string) {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId, videoId, deletedAt: IsNull() },
      relations: ['user'],
    });
    if (!comment) throw new NotFoundException('Comment not found');

    const likedIds = viewerId
      ? await this.getViewerLikedCommentIds(viewerId, [comment.id])
      : new Set<string>();
    const dislikedIds = viewerId
      ? await this.getViewerDislikedCommentIds(viewerId, [comment.id])
      : new Set<string>();
    const replyCounts =
      comment.parentId == null
        ? await this.getReplyCounts([comment.id])
        : new Map<string, number>();

    return toPublicComment(comment, {
      viewerLiked: likedIds.has(comment.id),
      viewerDisliked: dislikedIds.has(comment.id),
      replyCount: replyCounts.get(comment.id) ?? 0,
    });
  }

  private async getReplyCounts(parentIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (!parentIds.length) return map;
    const rows = await this.commentRepository
      .createQueryBuilder('c')
      .select('c.parent_id', 'parentId')
      .addSelect('COUNT(*)', 'cnt')
      .where('c.parent_id IN (:...parentIds)', { parentIds })
      .andWhere('c.deleted_at IS NULL')
      .groupBy('c.parent_id')
      .getRawMany<{ parentId: string; cnt: string }>();
    for (const row of rows) {
      map.set(row.parentId, Number.parseInt(row.cnt, 10) || 0);
    }
    return map;
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
    const dislikedIds = viewerId
      ? await this.getViewerDislikedCommentIds(viewerId, data.map((c) => c.id))
      : new Set<string>();

    return {
      data: data.map((c) =>
        toPublicComment(c, {
          viewerLiked: likedIds.has(c.id),
          viewerDisliked: dislikedIds.has(c.id),
        }),
      ),
      meta: { cursor: nextCursor, hasMore },
    };
  }

  private async getViewerLikedCommentIds(
    viewerId: string,
    commentIds: string[],
  ): Promise<Set<string>> {
    if (!commentIds.length) return new Set();
    const rows = await this.commentLikeRepository.find({
      where: { userId: viewerId, commentId: In(commentIds), reaction: CommentReactionType.LIKE },
      select: ['commentId'],
    });
    return new Set(rows.map((r) => r.commentId));
  }

  private async getViewerDislikedCommentIds(
    viewerId: string,
    commentIds: string[],
  ): Promise<Set<string>> {
    if (!commentIds.length) return new Set();
    const rows = await this.commentLikeRepository.find({
      where: {
        userId: viewerId,
        commentId: In(commentIds),
        reaction: CommentReactionType.DISLIKE,
      },
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

    const isAuthor = comment.userId === userId;
    const isAdmin = userRole === UserRole.ADMIN;
    let isVideoOwner = false;
    if (!isAuthor && !isAdmin) {
      const video = await this.videoRepository.findOne({
        where: { id: videoId },
        select: { id: true, userId: true },
      });
      if (!video) throw new NotFoundException('Video not found');
      isVideoOwner = video.userId === userId;
    }
    if (!isAuthor && !isAdmin && !isVideoOwner) {
      throw new ForbiddenException('Not allowed to delete this comment');
    }

    comment.deletedAt = new Date();
    comment.content = '[deleted]';
    await this.commentRepository.save(comment);
    await this.videoRepository.decrement({ id: videoId }, 'commentCount', 1);

    return { deleted: true };
  }

  async likeComment(userId: string, videoId: string, commentId: string) {
    return this.setCommentReaction(userId, videoId, commentId, CommentReactionType.LIKE);
  }

  async unlikeComment(userId: string, videoId: string, commentId: string) {
    return this.clearCommentReaction(userId, videoId, commentId, CommentReactionType.LIKE);
  }

  async dislikeComment(userId: string, videoId: string, commentId: string) {
    return this.setCommentReaction(userId, videoId, commentId, CommentReactionType.DISLIKE);
  }

  async undislikeComment(userId: string, videoId: string, commentId: string) {
    return this.clearCommentReaction(userId, videoId, commentId, CommentReactionType.DISLIKE);
  }

  private async setCommentReaction(
    userId: string,
    videoId: string,
    commentId: string,
    reaction: CommentReactionType,
  ) {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId, videoId, deletedAt: IsNull() },
    });
    if (!comment) throw new NotFoundException('Comment not found');

    const existing = await this.commentLikeRepository.findOne({ where: { userId, commentId } });
    if (existing?.reaction === reaction) {
      return reaction === CommentReactionType.LIKE
        ? { liked: true, disliked: false }
        : { liked: false, disliked: true };
    }

    if (existing) {
      const prev = existing.reaction;
      existing.reaction = reaction;
      await this.commentLikeRepository.save(existing);
      if (prev === CommentReactionType.LIKE) {
        await this.commentRepository.decrement({ id: commentId }, 'likeCount', 1);
      } else {
        await this.commentRepository.decrement({ id: commentId }, 'dislikeCount', 1);
      }
      if (reaction === CommentReactionType.LIKE) {
        await this.commentRepository.increment({ id: commentId }, 'likeCount', 1);
      } else {
        await this.commentRepository.increment({ id: commentId }, 'dislikeCount', 1);
      }
    } else {
      await this.commentLikeRepository.save(
        this.commentLikeRepository.create({ userId, commentId, reaction }),
      );
      if (reaction === CommentReactionType.LIKE) {
        await this.commentRepository.increment({ id: commentId }, 'likeCount', 1);
      } else {
        await this.commentRepository.increment({ id: commentId }, 'dislikeCount', 1);
      }
    }

    return reaction === CommentReactionType.LIKE
      ? { liked: true, disliked: false }
      : { liked: false, disliked: true };
  }

  private async clearCommentReaction(
    userId: string,
    videoId: string,
    commentId: string,
    expected?: CommentReactionType,
  ) {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId, videoId, deletedAt: IsNull() },
      select: { id: true },
    });
    if (!comment) throw new NotFoundException('Comment not found');

    const row = await this.commentLikeRepository.findOne({ where: { userId, commentId } });
    if (!row) {
      return { liked: false, disliked: false };
    }
    if (expected && row.reaction !== expected) {
      return row.reaction === CommentReactionType.LIKE
        ? { liked: true, disliked: false }
        : { liked: false, disliked: true };
    }

    const prev = row.reaction;
    await this.commentLikeRepository.remove(row);
    if (prev === CommentReactionType.LIKE) {
      await this.commentRepository.decrement({ id: commentId }, 'likeCount', 1);
    } else {
      await this.commentRepository.decrement({ id: commentId }, 'dislikeCount', 1);
    }
    return { liked: false, disliked: false };
  }

  private async assertVideoOwner(actorId: string, videoId: string) {
    const video = await this.videoRepository.findOne({
      where: { id: videoId },
      select: { id: true, userId: true },
    });
    if (!video) throw new NotFoundException('Video not found');
    if (video.userId !== actorId) {
      throw new ForbiddenException('Only the video owner can manage this');
    }
    return video;
  }

  /** YouTube-style: pin one top-level comment (or unpin). */
  async setCommentPinned(
    actorId: string,
    videoId: string,
    commentId: string,
    isPinned: boolean,
  ) {
    await this.assertVideoOwner(actorId, videoId);
    const comment = await this.commentRepository.findOne({
      where: { id: commentId, videoId, deletedAt: IsNull() },
      relations: ['user'],
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.parentId) {
      throw new BadRequestException('Only top-level comments can be pinned');
    }

    if (isPinned) {
      await this.commentRepository.update(
        { videoId, parentId: IsNull(), isPinned: true },
        { isPinned: false },
      );
      comment.isPinned = true;
    } else {
      comment.isPinned = false;
    }
    const saved = await this.commentRepository.save(comment);
    return toPublicComment(saved);
  }

  /** YouTube-style creator heart on a comment. */
  async setCommentCreatorHeart(
    actorId: string,
    videoId: string,
    commentId: string,
    creatorHearted: boolean,
  ) {
    await this.assertVideoOwner(actorId, videoId);
    const comment = await this.commentRepository.findOne({
      where: { id: commentId, videoId, deletedAt: IsNull() },
      relations: ['user'],
    });
    if (!comment) throw new NotFoundException('Comment not found');
    comment.creatorHearted = creatorHearted;
    const saved = await this.commentRepository.save(comment);
    return toPublicComment(saved);
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

    return { following: true, subscribed: true };
  }

  async unfollow(followerId: string, followingId: string) {
    const follow = await this.followRepository.findOne({ where: { followerId, followingId } });
    if (!follow) throw new NotFoundException('Not following');

    await this.followRepository.remove(follow);
    await this.userRepository.decrement({ id: followerId }, 'followingCount', 1);
    await this.userRepository.decrement({ id: followingId }, 'followerCount', 1);

    return { following: false, subscribed: false };
  }

  /** YouTube-facing alias for follow. */
  async subscribe(subscriberId: string, channelId: string) {
    return this.follow(subscriberId, channelId);
  }

  /** YouTube-facing alias for unfollow. */
  async unsubscribe(subscriberId: string, channelId: string) {
    return this.unfollow(subscriberId, channelId);
  }

  async getSubscription(subscriberId: string, channelId: string) {
    const follow = await this.followRepository.findOne({
      where: { followerId: subscriberId, followingId: channelId },
    });
    if (!follow) {
      return { subscribed: false, notifyLevel: null as FollowNotifyLevel | null };
    }
    return { subscribed: true, notifyLevel: follow.notifyLevel ?? FollowNotifyLevel.ALL };
  }

  async setNotifyLevel(
    subscriberId: string,
    channelId: string,
    notifyLevel: FollowNotifyLevel,
  ) {
    const follow = await this.followRepository.findOne({
      where: { followerId: subscriberId, followingId: channelId },
    });
    if (!follow) throw new NotFoundException('Not subscribed to this channel');
    follow.notifyLevel = notifyLevel;
    await this.followRepository.save(follow);
    return { subscribed: true, notifyLevel: follow.notifyLevel };
  }

  async listMutedChannels(userId: string) {
    const ids = await getMutedChannelIds(this.redis, userId);
    if (!ids.length) {
      return [] as Array<{
        id: string;
        username: string;
        displayName: string;
        avatarUrl: string | null;
      }>;
    }
    const users = await this.userRepository.find({
      where: { id: In(ids) },
      select: ['id', 'username', 'displayName', 'avatarUrl'],
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    return ids
      .map((id) => {
        const u = byId.get(id);
        if (!u) return null;
        return {
          id: u.id,
          username: u.username,
          displayName: u.displayName,
          avatarUrl: (u.avatarUrl ?? null) as string | null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);
  }

  async unmuteChannelRecommendations(userId: string, channelId: string) {
    return unmuteChannel(this.redis, userId, channelId);
  }

  async isSubscribed(subscriberId: string, channelId: string): Promise<boolean> {
    return this.isFollowing(subscriberId, channelId);
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
