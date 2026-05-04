import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { Video, VideoStatus, VideoVisibility } from '../content/entities/video.entity';

const FEED_CACHE_TTL = 300; // 5 minutes

@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);

  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  async getFeed(options: {
    categoryId?: string;
    cursor?: string;
    limit?: number;
    userId?: string;
  }) {
    const limit = Math.min(options.limit || 20, 50);
    const cacheKey = `feed:${options.categoryId || 'all'}:${options.cursor || 'start'}:${limit}`;

    const cached = await this.redis.get(cacheKey);
    if (cached && !options.userId) {
      return JSON.parse(cached);
    }

    const query = this.videoRepository
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.user', 'user')
      .leftJoinAndSelect('v.skillTags', 'skillTags')
      .leftJoinAndSelect('skillTags.subcategory', 'subcategory')
      .leftJoinAndSelect('subcategory.category', 'category')
      .where('v.status = :status', { status: VideoStatus.READY })
      .andWhere('v.visibility = :visibility', { visibility: VideoVisibility.PUBLIC })
      .orderBy('v.createdAt', 'DESC')
      .take(limit + 1);

    if (options.categoryId) {
      query.andWhere('category.id = :categoryId', { categoryId: options.categoryId });
    }

    if (options.cursor) {
      const cursorDate = new Date(Buffer.from(options.cursor, 'base64').toString('utf-8'));
      query.andWhere('v.createdAt < :cursor', { cursor: cursorDate });
    }

    const videos = await query.getMany();
    const hasMore = videos.length > limit;
    const data = hasMore ? videos.slice(0, limit) : videos;
    const nextCursor = hasMore
      ? Buffer.from(data[data.length - 1].createdAt.toISOString()).toString('base64')
      : null;

    const result = { data, meta: { cursor: nextCursor, hasMore } };

    if (!options.userId) {
      await this.redis.setex(cacheKey, FEED_CACHE_TTL, JSON.stringify(result));
    }

    return result;
  }

  async invalidateFeedCache(categoryId?: string) {
    const pattern = categoryId ? `feed:${categoryId}:*` : 'feed:*';
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
