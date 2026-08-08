import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Video } from '../content/entities/video.entity';
import { User } from '../users/entities/user.entity';
import { Comment } from './entities/comment.entity';
import { Like } from './entities/like.entity';
import { Follow } from './entities/follow.entity';
import { CommentLike } from './entities/comment-like.entity';

/** Cap mismatch rows updated per daily pass to bound write storms on large tables. */
const MISMATCH_LIMIT = 1000;

/**
 * Update chunk size for mismatch fixups. Sequential per-row updates paid a
 * full round-trip per row; a batch of 25 keeps peak DB concurrency low
 * enough for a shared-CPU worker while cutting elapsed reconcile time by
 * ~20×. Promise.allSettled is used so a single bad row (e.g. FK removed
 * mid-run) doesn't abort the pass.
 */
const UPDATE_CHUNK_SIZE = 25;

async function updateInChunks<T>(
  rows: T[],
  updater: (row: T) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < rows.length; i += UPDATE_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + UPDATE_CHUNK_SIZE);
    await Promise.allSettled(chunk.map(updater));
  }
}

@Injectable()
export class EngagementReconciliationService {
  private readonly logger = new Logger(EngagementReconciliationService.name);

  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(Like)
    private readonly likeRepository: Repository<Like>,
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
    @InjectRepository(CommentLike)
    private readonly commentLikeRepository: Repository<CommentLike>,
  ) {}

  async reconcileAll(): Promise<{ videos: number; users: number; comments: number; videoComments: number }> {
    // Sequential: four full-table GROUP BYs in parallel spiked worker/DB peak memory.
    const videoLikes = await this.reconcileVideoLikeCounts();
    const users = await this.reconcileFollowCounts();
    const commentLikes = await this.reconcileCommentLikeCounts();
    const videoComments = await this.reconcileVideoCommentCounts();
    this.logger.log(
      `Engagement reconciliation complete: ${videoLikes} video likes, ${users} users, ${commentLikes} comment likes, ${videoComments} video comment counts adjusted`,
    );
    return { videos: videoLikes, users, comments: commentLikes, videoComments };
  }

  private async reconcileVideoLikeCounts(): Promise<number> {
    const mismatches = await this.videoRepository
      .createQueryBuilder('v')
      .select('v.id', 'id')
      .addSelect('v.like_count', 'stored')
      .addSelect('COUNT(l.id)', 'actual')
      .leftJoin('likes', 'l', 'l.video_id = v.id')
      .groupBy('v.id')
      .addGroupBy('v.like_count')
      .having('v.like_count != COUNT(l.id)')
      .limit(MISMATCH_LIMIT)
      .getRawMany<{ id: string; stored: string; actual: string }>();

    await updateInChunks(mismatches, (row) =>
      this.videoRepository.update(row.id, { likeCount: parseInt(row.actual, 10) || 0 }),
    );
    return mismatches.length;
  }

  private async reconcileFollowCounts(): Promise<number> {
    const followerMismatches = await this.userRepository
      .createQueryBuilder('u')
      .select('u.id', 'id')
      .addSelect('u.follower_count', 'stored')
      .addSelect('COUNT(f.id)', 'actual')
      .leftJoin('follows', 'f', 'f.following_id = u.id')
      .groupBy('u.id')
      .addGroupBy('u.follower_count')
      .having('u.follower_count != COUNT(f.id)')
      .limit(MISMATCH_LIMIT)
      .getRawMany<{ id: string; stored: string; actual: string }>();

    const followingMismatches = await this.userRepository
      .createQueryBuilder('u')
      .select('u.id', 'id')
      .addSelect('u.following_count', 'stored')
      .addSelect('COUNT(f.id)', 'actual')
      .leftJoin('follows', 'f', 'f.follower_id = u.id')
      .groupBy('u.id')
      .addGroupBy('u.following_count')
      .having('u.following_count != COUNT(f.id)')
      .limit(MISMATCH_LIMIT)
      .getRawMany<{ id: string; stored: string; actual: string }>();

    const byId = new Map<string, { followerCount?: number; followingCount?: number }>();

    for (const row of followerMismatches) {
      const entry = byId.get(row.id) ?? {};
      entry.followerCount = parseInt(row.actual, 10) || 0;
      byId.set(row.id, entry);
    }
    for (const row of followingMismatches) {
      const entry = byId.get(row.id) ?? {};
      entry.followingCount = parseInt(row.actual, 10) || 0;
      byId.set(row.id, entry);
    }

    await updateInChunks(
      Array.from(byId.entries()),
      ([userId, patch]) => this.userRepository.update(userId, patch),
    );

    return byId.size;
  }

  private async reconcileCommentLikeCounts(): Promise<number> {
    const mismatches = await this.commentRepository
      .createQueryBuilder('c')
      .select('c.id', 'id')
      .addSelect('c.like_count', 'stored')
      .addSelect('COUNT(cl.id)', 'actual')
      .leftJoin('comment_likes', 'cl', "cl.comment_id = c.id AND cl.reaction = 'like'")
      .groupBy('c.id')
      .addGroupBy('c.like_count')
      .having('c.like_count != COUNT(cl.id)')
      .limit(MISMATCH_LIMIT)
      .getRawMany<{ id: string; stored: string; actual: string }>();

    await updateInChunks(mismatches, (row) =>
      this.commentRepository.update(row.id, { likeCount: parseInt(row.actual, 10) || 0 }),
    );
    return mismatches.length;
  }

  private async reconcileVideoCommentCounts(): Promise<number> {
    const mismatches = await this.videoRepository
      .createQueryBuilder('v')
      .select('v.id', 'id')
      .addSelect('v.comment_count', 'stored')
      .addSelect('COUNT(c.id)', 'actual')
      .leftJoin('comments', 'c', 'c.video_id = v.id AND c.deleted_at IS NULL')
      .groupBy('v.id')
      .addGroupBy('v.comment_count')
      .having('v.comment_count != COUNT(c.id)')
      .limit(MISMATCH_LIMIT)
      .getRawMany<{ id: string; stored: string; actual: string }>();

    await updateInChunks(mismatches, (row) =>
      this.videoRepository.update(row.id, { commentCount: parseInt(row.actual, 10) || 0 }),
    );
    return mismatches.length;
  }
}
