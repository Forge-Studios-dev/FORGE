import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommunityPost, CommunityPostType } from './entities/community-post.entity';
import { Community } from './entities/community.entity';

@Injectable()
export class CommunityPostsService {
  constructor(
    @InjectRepository(CommunityPost)
    private readonly postRepository: Repository<CommunityPost>,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
  ) {}

  private async assertOwnedCommunity(creatorId: string, communityId: string) {
    const community = await this.communityRepository.findOne({ where: { id: communityId } });
    if (!community || community.creatorId !== creatorId) {
      throw new ForbiddenException('Community not found or not owned');
    }
    return community;
  }

  async listPosts(communityId: string, limit = 30, cursor?: string) {
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
        createdAt: p.createdAt,
      })),
      meta: { cursor: nextCursor, hasMore },
    };
  }

  async createPost(
    creatorId: string,
    communityId: string,
    authorId: string,
    input: { title?: string; body: string; postType?: CommunityPostType; isPinned?: boolean },
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
      }),
    );
    return { id: post.id, createdAt: post.createdAt };
  }

  async searchPosts(communityId: string, query: string, limit = 20) {
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
}
