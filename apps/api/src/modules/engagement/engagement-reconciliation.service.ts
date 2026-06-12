import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Video } from '../content/entities/video.entity';
import { User } from '../users/entities/user.entity';
import { Comment } from './entities/comment.entity';
import { Like } from './entities/like.entity';
import { Follow } from './entities/follow.entity';
import { CommentLike } from './entities/comment-like.entity';

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
    const [videoLikes, users, commentLikes, videoComments] = await Promise.all([
      this.reconcileVideoLikeCounts(),
      this.reconcileFollowCounts(),
      this.reconcileCommentLikeCounts(),
      this.reconcileVideoCommentCounts(),
    ]);
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
      .getRawMany<{ id: string; stored: string; actual: string }>();

    for (const row of mismatches) {
      await this.videoRepository.update(row.id, { likeCount: parseInt(row.actual, 10) || 0 });
    }
    return mismatches.length;
  }

  private async reconcileFollowCounts(): Promise<number> {
    let adjusted = 0;
    const users = await this.userRepository.find({ select: ['id', 'followerCount', 'followingCount'] });
    for (const user of users) {
      const followerActual = await this.followRepository.count({ where: { followingId: user.id } });
      const followingActual = await this.followRepository.count({ where: { followerId: user.id } });
      if (user.followerCount !== followerActual || user.followingCount !== followingActual) {
        await this.userRepository.update(user.id, {
          followerCount: followerActual,
          followingCount: followingActual,
        });
        adjusted++;
      }
    }
    return adjusted;
  }

  private async reconcileCommentLikeCounts(): Promise<number> {
    const mismatches = await this.commentRepository
      .createQueryBuilder('c')
      .select('c.id', 'id')
      .addSelect('c.like_count', 'stored')
      .addSelect('COUNT(cl.id)', 'actual')
      .leftJoin('comment_likes', 'cl', 'cl.comment_id = c.id')
      .groupBy('c.id')
      .addGroupBy('c.like_count')
      .having('c.like_count != COUNT(cl.id)')
      .getRawMany<{ id: string; stored: string; actual: string }>();

    for (const row of mismatches) {
      await this.commentRepository.update(row.id, { likeCount: parseInt(row.actual, 10) || 0 });
    }
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
      .getRawMany<{ id: string; stored: string; actual: string }>();

    for (const row of mismatches) {
      await this.videoRepository.update(row.id, { commentCount: parseInt(row.actual, 10) || 0 });
    }
    return mismatches.length;
  }
}
