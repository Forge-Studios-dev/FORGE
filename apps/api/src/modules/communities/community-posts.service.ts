import { BadRequestException, ForbiddenException, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { CommunityPost, CommunityPostType } from './entities/community-post.entity';
import { CommunityPostComment } from './entities/community-post-comment.entity';
import {
  CommunityPostReaction,
  CommunityPostReactionType,
} from './entities/community-post-reaction.entity';
import { Community } from './entities/community.entity';
import { CommunitiesService } from './communities.service';
import { UserRole } from '../users/entities/user.entity';
import {
  COMMUNITY_ANNOUNCEMENT_NOTIFY_QUEUE,
  type CommunityAnnouncementNotifyJobData,
} from '../workers/community-announcement-notify/community-announcement-notify.constants';
import {
  PlatformEventOutboxService,
  PLATFORM_EVENT_TYPES,
} from '../platform-event-outbox/platform-event-outbox.service';
import { CommunityStorageService } from './community-storage.service';

const MAX_POST_MEDIA = 4;

function sanitizeMediaUrls(urls?: string[]): string[] {
  if (!urls?.length) return [];
  const out: string[] = [];
  for (const raw of urls.slice(0, MAX_POST_MEDIA)) {
    const url = raw.trim();
    if (!url.startsWith('https://') || url.length > 2048) continue;
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:') out.push(parsed.toString());
    } catch {
      /* skip invalid */
    }
  }
  return out;
}

@Injectable()
export class CommunityPostsService {
  constructor(
    @InjectRepository(CommunityPost)
    private readonly postRepository: Repository<CommunityPost>,
    @InjectRepository(CommunityPostComment)
    private readonly commentRepository: Repository<CommunityPostComment>,
    @InjectRepository(CommunityPostReaction)
    private readonly reactionRepository: Repository<CommunityPostReaction>,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    private readonly communitiesService: CommunitiesService,
    private readonly eventEmitter: EventEmitter2,
    private readonly storageService: CommunityStorageService,
    @Optional()
    @InjectQueue(COMMUNITY_ANNOUNCEMENT_NOTIFY_QUEUE)
    private readonly announcementQueue?: Queue<CommunityAnnouncementNotifyJobData>,
    @Optional()
    private readonly outboxService?: PlatformEventOutboxService,
  ) {}

  private async assertOwnedCommunity(creatorId: string, communityId: string) {
    const community = await this.communityRepository.findOne({ where: { id: communityId } });
    if (!community || community.creatorId !== creatorId) {
      throw new ForbiddenException('Community not found or not owned');
    }
    return community;
  }

  async getMediaUploadUrl(creatorId: string, communityId: string, contentType: string) {
    await this.assertOwnedCommunity(creatorId, communityId);
    if (!this.storageService.isConfigured()) {
      throw new BadRequestException('Media upload storage is not configured');
    }
    return this.storageService.getPostMediaUploadUrl(communityId, contentType);
  }

  async listPosts(
    communityId: string,
    limit = 30,
    cursor?: string,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ) {
    await this.communitiesService.assertCommunityAccess(communityId, viewerId, viewerRole);
    const qb = this.postRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.author', 'author')
      .where('p.community_id = :communityId', { communityId })
      .orderBy('p.is_pinned', 'DESC')
      .addOrderBy('p.created_at', 'DESC')
      .take(limit + 1);

    if (cursor) {
      qb.andWhere('p.created_at < :cursor', { cursor: new Date(cursor) });
    }

    const posts = await qb.getMany();
    const hasMore = posts.length > limit;
    const data = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = hasMore ? data[data.length - 1]?.createdAt.toISOString() : null;
    const postIds = data.map((p) => p.id);
    const counts = await this.getPostEngagementCounts(postIds, viewerId ?? undefined);

    return {
      data: data.map((p) => ({
        id: p.id,
        communityId: p.communityId,
        authorId: p.authorId,
        author: p.author
          ? { displayName: p.author.displayName, username: p.author.username }
          : null,
        title: p.title,
        body: p.body,
        postType: p.postType,
        isPinned: p.isPinned,
        mediaUrls: p.mediaUrls ?? [],
        createdAt: p.createdAt,
        commentCount: counts.comments.get(p.id) ?? 0,
        likeCount: counts.likes.get(p.id) ?? 0,
        likedByMe: counts.likedByMe.has(p.id),
      })),
      meta: { cursor: nextCursor, hasMore },
    };
  }

  private async getPostEngagementCounts(postIds: string[], viewerId?: string) {
    const comments = new Map<string, number>();
    const likes = new Map<string, number>();
    const likedByMe = new Set<string>();
    if (postIds.length === 0) return { comments, likes, likedByMe };

    const commentRows = await this.commentRepository
      .createQueryBuilder('c')
      .select('c.post_id', 'postId')
      .addSelect('COUNT(*)', 'count')
      .where('c.post_id IN (:...postIds)', { postIds })
      .groupBy('c.post_id')
      .getRawMany<{ postId: string; count: string }>();
    for (const row of commentRows) {
      comments.set(row.postId, Number(row.count));
    }

    const likeRows = await this.reactionRepository
      .createQueryBuilder('r')
      .select('r.post_id', 'postId')
      .addSelect('COUNT(*)', 'count')
      .where('r.post_id IN (:...postIds)', { postIds })
      .andWhere('r.reaction_type = :type', { type: CommunityPostReactionType.LIKE })
      .groupBy('r.post_id')
      .getRawMany<{ postId: string; count: string }>();
    for (const row of likeRows) {
      likes.set(row.postId, Number(row.count));
    }

    if (viewerId) {
      const myLikes = await this.reactionRepository
        .createQueryBuilder('r')
        .select('r.post_id', 'postId')
        .where('r.user_id = :viewerId', { viewerId })
        .andWhere('r.post_id IN (:...postIds)', { postIds })
        .andWhere('r.reaction_type = :type', { type: CommunityPostReactionType.LIKE })
        .getRawMany<{ postId: string }>();
      for (const r of myLikes) likedByMe.add(r.postId);
    }

    return { comments, likes, likedByMe };
  }

  async createPost(
    creatorId: string,
    communityId: string,
    authorId: string,
    input: {
      title?: string;
      body: string;
      postType?: CommunityPostType;
      isPinned?: boolean;
      mediaUrls?: string[];
    },
  ) {
    await this.assertOwnedCommunity(creatorId, communityId);
    const post = await this.postRepository.save(
      this.postRepository.create({
        communityId,
        authorId,
        title: input.title?.trim() || null,
        body: input.body.trim(),
        postType: input.postType ?? CommunityPostType.POST,
        isPinned: input.isPinned ?? false,
        mediaUrls: sanitizeMediaUrls(input.mediaUrls),
      }),
    );

    if (post.postType === CommunityPostType.ANNOUNCEMENT) {
      void this.enqueueAnnouncementNotify(communityId, post.id, input).catch(() => undefined);
    }

    this.eventEmitter.emit('community.activity', {
      userId: authorId,
      communityId,
      xp: 5,
      source: 'community_post',
    });

    return { id: post.id, createdAt: post.createdAt };
  }

  private async enqueueAnnouncementNotify(
    communityId: string,
    postId: string,
    input: { title?: string; body: string },
  ) {
    const community = await this.communityRepository.findOne({ where: { id: communityId } });
    if (!community) return;

    const payload: CommunityAnnouncementNotifyJobData = {
      communityId,
      postId,
      creatorId: community.creatorId,
      title: input.title?.trim() || 'New announcement',
      body: input.body.trim(),
    };

    if (this.outboxService) {
      await this.outboxService.append({
        eventType: PLATFORM_EVENT_TYPES.COMMUNITY_ANNOUNCEMENT_NOTIFY,
        payload,
        idempotencyKey: `announcement:${postId}`,
      });
      return;
    }

    if (!this.announcementQueue) return;
    await this.announcementQueue.add('notify', payload, { jobId: `announcement:${postId}` });
  }

  async searchPosts(
    communityId: string,
    query: string,
    limit = 20,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ) {
    await this.communitiesService.assertCommunityAccess(communityId, viewerId, viewerRole);
    const q = query.trim();
    if (!q) return { data: [] };
    const posts = await this.postRepository
      .createQueryBuilder('p')
      .where('p.community_id = :communityId', { communityId })
      .andWhere('(p.title ILIKE :like OR p.body ILIKE :like)', { like: `%${q}%` })
      .orderBy('p.created_at', 'DESC')
      .take(limit)
      .getMany();
    return {
      data: posts.map((p) => ({
        id: p.id,
        title: p.title,
        body: p.body.slice(0, 200),
        postType: p.postType,
        createdAt: p.createdAt,
      })),
    };
  }

  async updatePost(
    creatorId: string,
    communityId: string,
    postId: string,
    input: { title?: string; body?: string; isPinned?: boolean },
  ) {
    await this.assertOwnedCommunity(creatorId, communityId);
    const post = await this.postRepository.findOne({ where: { id: postId, communityId } });
    if (!post) throw new ForbiddenException('Post not found');

    if (input.title !== undefined) post.title = input.title.trim() || null;
    if (input.body !== undefined) post.body = input.body.trim();
    if (input.isPinned !== undefined) post.isPinned = input.isPinned;

    const saved = await this.postRepository.save(post);
    return {
      id: saved.id,
      title: saved.title,
      body: saved.body,
      postType: saved.postType,
      isPinned: saved.isPinned,
      updatedAt: saved.updatedAt,
    };
  }

  async deletePost(creatorId: string, communityId: string, postId: string) {
    await this.assertOwnedCommunity(creatorId, communityId);
    const result = await this.postRepository.delete({ id: postId, communityId });
    if (!result.affected) throw new ForbiddenException('Post not found');
    return { deleted: true };
  }

  async setPostPinned(
    creatorId: string,
    communityId: string,
    postId: string,
    isPinned: boolean,
  ) {
    return this.updatePost(creatorId, communityId, postId, { isPinned });
  }

  private async assertPostInCommunity(communityId: string, postId: string) {
    const post = await this.postRepository.findOne({ where: { id: postId, communityId } });
    if (!post) throw new ForbiddenException('Post not found');
    return post;
  }

  async listComments(
    communityId: string,
    postId: string,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ) {
    await this.communitiesService.assertCommunityAccess(communityId, viewerId, viewerRole);
    await this.assertPostInCommunity(communityId, postId);

    const comments = await this.commentRepository.find({
      where: { postId },
      relations: ['author'],
      order: { createdAt: 'ASC' },
      take: 200,
    });

    return {
      data: comments.map((c) => ({
        id: c.id,
        postId: c.postId,
        authorId: c.authorId,
        author: c.author
          ? { displayName: c.author.displayName, username: c.author.username }
          : null,
        body: c.body,
        parentId: c.parentId,
        createdAt: c.createdAt,
      })),
    };
  }

  async createComment(
    communityId: string,
    postId: string,
    authorId: string,
    input: { body: string; parentId?: string },
    viewerRole?: UserRole | null,
  ) {
    await this.communitiesService.assertCommunityAccess(communityId, authorId, viewerRole);
    await this.assertPostInCommunity(communityId, postId);

    const body = input.body.trim();
    if (!body) throw new BadRequestException('Comment body is required');

    if (input.parentId) {
      const parent = await this.commentRepository.findOne({
        where: { id: input.parentId, postId },
      });
      if (!parent) throw new BadRequestException('Parent comment not found');
    }

    const comment = await this.commentRepository.save(
      this.commentRepository.create({
        postId,
        authorId,
        body,
        parentId: input.parentId ?? null,
      }),
    );

    this.eventEmitter.emit('community.activity', {
      userId: authorId,
      communityId,
      xp: 2,
      source: 'community_post_comment',
    });

    return { id: comment.id, createdAt: comment.createdAt };
  }

  async deleteComment(
    communityId: string,
    postId: string,
    commentId: string,
    requesterId: string,
    viewerRole?: UserRole | null,
  ) {
    await this.communitiesService.assertCommunityAccess(communityId, requesterId, viewerRole);
    const post = await this.assertPostInCommunity(communityId, postId);
    const comment = await this.commentRepository.findOne({ where: { id: commentId, postId } });
    if (!comment) throw new ForbiddenException('Comment not found');

    const community = await this.communityRepository.findOne({ where: { id: communityId } });
    const isCreator = community?.creatorId === requesterId;
    if (comment.authorId !== requesterId && !isCreator) {
      throw new ForbiddenException('Not allowed to delete this comment');
    }

    await this.commentRepository.delete({ id: commentId, postId });
    return { deleted: true, postAuthorId: post.authorId };
  }

  async toggleReaction(
    communityId: string,
    postId: string,
    userId: string,
    viewerRole?: UserRole | null,
  ) {
    await this.communitiesService.assertCommunityAccess(communityId, userId, viewerRole);
    await this.assertPostInCommunity(communityId, postId);

    const existing = await this.reactionRepository.findOne({
      where: { postId, userId, reactionType: CommunityPostReactionType.LIKE },
    });

    if (existing) {
      await this.reactionRepository.delete({ id: existing.id });
      return { liked: false };
    }

    await this.reactionRepository.save(
      this.reactionRepository.create({
        postId,
        userId,
        reactionType: CommunityPostReactionType.LIKE,
      }),
    );
    return { liked: true };
  }
}
