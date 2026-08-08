import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, Optional, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { In, Repository } from 'typeorm';
import { CommunityPost, CommunityPostType } from './entities/community-post.entity';
import { CommunityPostComment } from './entities/community-post-comment.entity';
import {
  CommunityPostReaction,
  CommunityPostReactionType,
} from './entities/community-post-reaction.entity';
import { Community, CommunityType, CommunityVisibility } from './entities/community.entity';
import { CommunitiesService } from './communities.service';
import { CommunityModerationService } from './community-moderation.service';
import { AiCommunityService } from './ai-community.service';
import { CommunityModerationQueueService } from './community-moderation-queue.service';
import { User, UserRole } from '../users/entities/user.entity';
import {
  COMMUNITY_ANNOUNCEMENT_NOTIFY_QUEUE,
  type CommunityAnnouncementNotifyJobData,
} from '../workers/community-announcement-notify/community-announcement-notify.constants';
import {
  PlatformEventOutboxService,
  PLATFORM_EVENT_TYPES,
} from '../platform-event-outbox/platform-event-outbox.service';
import { CommunityStorageService } from './community-storage.service';
import { EngagementService } from '../engagement/engagement.service';
import { clampLimit } from '../../common/utils/pagination.util';

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
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(forwardRef(() => CommunitiesService))
    private readonly communitiesService: CommunitiesService,
    private readonly engagementService: EngagementService,
    private readonly moderationService: CommunityModerationService,
    private readonly aiCommunityService: AiCommunityService,
    private readonly moderationQueueService: CommunityModerationQueueService,
    private readonly eventEmitter: EventEmitter2,
    private readonly storageService: CommunityStorageService,
    @Optional()
    @InjectQueue(COMMUNITY_ANNOUNCEMENT_NOTIFY_QUEUE)
    private readonly announcementQueue?: Queue<CommunityAnnouncementNotifyJobData>,
    @Optional()
    private readonly outboxService?: PlatformEventOutboxService,
  ) {}

  private async assertStudioAccess(
    actorId: string,
    communityId: string,
    viewerRole?: UserRole | null,
  ) {
    return this.communitiesService.assertCommunityStudioAccess(
      actorId,
      communityId,
      viewerRole,
    );
  }

  async getMediaUploadUrl(
    actorId: string,
    communityId: string,
    contentType: string,
    viewerRole?: UserRole | null,
  ) {
    await this.assertStudioAccess(actorId, communityId, viewerRole);
    if (!this.storageService.isConfigured()) {
      throw new BadRequestException('Media upload storage is not configured');
    }
    return this.storageService.getPostMediaUploadUrl(communityId, contentType);
  }

  /** Presign for YouTube-style channel Community compose (default public community). */
  async getChannelPostMediaUploadUrl(
    creatorId: string,
    contentType: string,
    viewerRole?: UserRole | null,
  ) {
    const community = await this.communitiesService.ensureDefaultCommunity(creatorId);
    if (community.visibility !== CommunityVisibility.PUBLIC) {
      community.visibility = CommunityVisibility.PUBLIC;
      await this.communityRepository.save(community);
    }
    return this.getMediaUploadUrl(creatorId, community.id, contentType, viewerRole);
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

  /**
   * YouTube-style channel Community tab: public posts across the creator’s
   * public STANDARD/EVENT communities (no membership required).
   */
  async listChannelPostsForCreator(
    creatorId: string,
    limit = 20,
    cursor?: string,
    viewerId?: string | null,
  ) {
    const take = clampLimit(limit, 20, 50);
    const communities = await this.communityRepository.find({
      where: {
        creatorId,
        visibility: CommunityVisibility.PUBLIC,
        communityType: In([CommunityType.STANDARD, CommunityType.EVENT]),
      },
      select: { id: true, name: true, slug: true },
      take: 20,
    });
    if (communities.length === 0) {
      return { data: [], meta: { cursor: null, hasMore: false } };
    }

    const communityIds = communities.map((c) => c.id);
    const communityById = new Map(communities.map((c) => [c.id, c]));

    const qb = this.postRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.author', 'author')
      .where('p.community_id IN (:...communityIds)', { communityIds })
      .orderBy('p.is_pinned', 'DESC')
      .addOrderBy('p.created_at', 'DESC')
      .take(take + 1);

    if (cursor) {
      const cursorDate = new Date(cursor);
      if (!Number.isNaN(cursorDate.getTime())) {
        qb.andWhere('p.created_at < :cursor', { cursor: cursorDate });
      }
    }

    const posts = await qb.getMany();
    const hasMore = posts.length > take;
    const data = hasMore ? posts.slice(0, take) : posts;
    const nextCursor = hasMore ? data[data.length - 1]?.createdAt.toISOString() : null;
    const counts = await this.getPostEngagementCounts(
      data.map((p) => p.id),
      viewerId ?? undefined,
    );

    return {
      data: data.map((p) => {
        const community = communityById.get(p.communityId);
        return {
          id: p.id,
          communityId: p.communityId,
          community: community
            ? { id: community.id, name: community.name, slug: community.slug }
            : null,
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
        };
      }),
      meta: { cursor: nextCursor, hasMore },
    };
  }

  /**
   * Creator updates feed: announcement posts aggregated across every community
   * the viewer actively belongs to (active membership already implies access,
   * so no per-community access check or leak of private/paid announcements).
   * Cursor-paginated by created_at. Reuses the community posts model and
   * engagement-count batching.
   */
  async getMemberUpdatesFeed(
    viewerId: string,
    limit = 20,
    cursor?: string,
  ) {
    let communityIds = await this.communitiesService.listActiveMemberCommunityIds(viewerId);
    if (communityIds.length === 0) {
      return { data: [], meta: { cursor: null, hasMore: false } };
    }

    const membershipCommunities = await this.communityRepository.find({
      where: { id: In(communityIds) },
      select: { id: true, creatorId: true },
    });
    const blocked = new Set(await this.engagementService.getBlockedPeerIds(viewerId));
    communityIds = membershipCommunities
      .filter((c) => !blocked.has(c.creatorId))
      .map((c) => c.id);
    if (communityIds.length === 0) {
      return { data: [], meta: { cursor: null, hasMore: false } };
    }

    const qb = this.postRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.author', 'author')
      .where('p.community_id IN (:...communityIds)', { communityIds })
      .andWhere('p.post_type = :type', { type: CommunityPostType.ANNOUNCEMENT })
      .orderBy('p.created_at', 'DESC')
      .take(limit + 1);

    if (cursor) {
      const cursorDate = new Date(cursor);
      if (!Number.isNaN(cursorDate.getTime())) {
        qb.andWhere('p.created_at < :cursor', { cursor: cursorDate });
      }
    }

    const posts = await qb.getMany();
    const hasMore = posts.length > limit;
    const data = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = hasMore ? data[data.length - 1]?.createdAt.toISOString() : null;

    const communities = await this.communityRepository.find({
      where: { id: In([...new Set(data.map((p) => p.communityId))]) },
      select: { id: true, name: true, slug: true, creatorId: true },
    });
    const communityById = new Map(communities.map((c) => [c.id, c]));
    const creatorIds = [...new Set(communities.map((c) => c.creatorId).filter(Boolean))];
    const creators =
      creatorIds.length === 0
        ? []
        : await this.userRepository.find({
            where: { id: In(creatorIds) },
            select: { id: true, username: true },
          });
    const usernameByCreatorId = new Map(creators.map((u) => [u.id, u.username]));

    const counts = await this.getPostEngagementCounts(
      data.map((p) => p.id),
      viewerId,
    );

    return {
      data: data.map((p) => {
        const community = communityById.get(p.communityId);
        const creatorUsername = community
          ? usernameByCreatorId.get(community.creatorId) ?? null
          : null;
        return {
          id: p.id,
          communityId: p.communityId,
          community: community
            ? {
                id: community.id,
                name: community.name,
                slug: community.slug,
                creatorId: community.creatorId,
                creatorUsername,
              }
            : null,
          authorId: p.authorId,
          author: p.author
            ? { displayName: p.author.displayName, username: p.author.username }
            : null,
          title: p.title,
          body: p.body,
          postType: p.postType,
          mediaUrls: p.mediaUrls ?? [],
          createdAt: p.createdAt,
          commentCount: counts.comments.get(p.id) ?? 0,
          likeCount: counts.likes.get(p.id) ?? 0,
          likedByMe: counts.likedByMe.has(p.id),
        };
      }),
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
    actorId: string,
    communityId: string,
    authorId: string,
    input: {
      title?: string;
      body: string;
      postType?: CommunityPostType;
      isPinned?: boolean;
      mediaUrls?: string[];
    },
    viewerRole?: UserRole | null,
  ) {
    await this.assertStudioAccess(actorId, communityId, viewerRole);
    const mediaUrls = sanitizeMediaUrls(input.mediaUrls);
    const body = (input.body ?? '').trim();
    if (!body && mediaUrls.length === 0) {
      throw new BadRequestException('Post body or media is required');
    }
    const post = await this.postRepository.save(
      this.postRepository.create({
        communityId,
        authorId,
        title: input.title?.trim() || null,
        body,
        postType: input.postType ?? CommunityPostType.POST,
        isPinned: input.isPinned ?? false,
        mediaUrls,
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

    this.eventEmitter.emit('community.post.created', {
      communityId,
      post: { id: post.id, authorId, postType: post.postType, createdAt: post.createdAt },
    });

    return { id: post.id, createdAt: post.createdAt, communityId };
  }

  /** YouTube-style: post to the creator’s default channel community (ensured). */
  async createChannelPost(
    creatorId: string,
    input: {
      title?: string;
      body: string;
      postType?: CommunityPostType;
      isPinned?: boolean;
      mediaUrls?: string[];
    },
    viewerRole?: UserRole | null,
  ) {
    const community = await this.communitiesService.ensureDefaultCommunity(creatorId);
    if (community.visibility !== CommunityVisibility.PUBLIC) {
      community.visibility = CommunityVisibility.PUBLIC;
      await this.communityRepository.save(community);
    }
    return this.createPost(creatorId, community.id, creatorId, input, viewerRole);
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
    actorId: string,
    communityId: string,
    postId: string,
    input: { title?: string; body?: string; isPinned?: boolean },
    viewerRole?: UserRole | null,
  ) {
    await this.assertStudioAccess(actorId, communityId, viewerRole);
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

  async deletePost(
    actorId: string,
    communityId: string,
    postId: string,
    viewerRole?: UserRole | null,
  ) {
    await this.assertStudioAccess(actorId, communityId, viewerRole);
    const result = await this.postRepository.delete({ id: postId, communityId });
    if (!result.affected) throw new ForbiddenException('Post not found');
    return { deleted: true };
  }

  async setPostPinned(
    actorId: string,
    communityId: string,
    postId: string,
    isPinned: boolean,
    viewerRole?: UserRole | null,
  ) {
    return this.updatePost(actorId, communityId, postId, { isPinned }, viewerRole);
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

    if (await this.moderationService.isBanned(communityId, authorId)) {
      throw new ForbiddenException('You are banned from this community');
    }

    const body = input.body.trim();
    if (!body) throw new BadRequestException('Comment body is required');

    const spam = this.aiCommunityService.scoreContent(body);
    if (spam.flagged) {
      void this.moderationQueueService.enqueueFlaggedMessage({
        communityId,
        channelId: postId,
        userId: authorId,
        messageBody: body,
        score: spam.score,
        reasons: spam.reasons,
        detectedBy: 'fast_path',
        surface: 'post_comment',
      });
      throw new ForbiddenException('Comment blocked by automated moderation');
    }

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

    this.moderationQueueService.maybeQueueLlmTail({
      communityId,
      surface: 'post_comment',
      surfaceId: postId,
      userId: authorId,
      messageId: comment.id,
      body,
      fastPathScore: spam.score,
    });

    this.eventEmitter.emit('community.activity', {
      userId: authorId,
      communityId,
      xp: 2,
      source: 'community_post_comment',
    });

    this.eventEmitter.emit('community.post.comment.created', {
      communityId,
      postId,
      comment: {
        id: comment.id,
        authorId,
        body: comment.body,
        parentId: comment.parentId,
        createdAt: comment.createdAt,
      },
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

  async acceptAnswer(
    communityId: string,
    postId: string,
    commentId: string,
    userId: string,
  ): Promise<{ acceptedAnswerId: string }> {
    const post = await this.postRepository.findOne({ where: { id: postId, communityId } });
    if (!post) throw new NotFoundException('Post not found');
    if (post.authorId !== userId) throw new ForbiddenException('Only the post author can accept an answer');
    if (post.postType !== CommunityPostType.QA) {
      throw new BadRequestException('Only Q&A posts support accepted answers');
    }

    const comment = await this.commentRepository.findOne({ where: { id: commentId, postId } });
    if (!comment) throw new NotFoundException('Comment not found');

    post.acceptedAnswerId = commentId;
    await this.postRepository.save(post);
    return { acceptedAnswerId: commentId };
  }
}
