import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article, ArticlePublishStatus, ArticleVisibility } from './entities/article.entity';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { EngagementService } from '../engagement/engagement.service';
import { clampLimit, clampPage } from '../../common/utils/pagination.util';
import { slugify } from '../../common/utils/slugify.util';

const MAX_TITLE_LENGTH = 200;
const MAX_EXCERPT_LENGTH = 500;
const MAX_BODY_LENGTH = 200_000;

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
    private readonly entitlementsService: EntitlementsService,
    private readonly engagementService: EngagementService,
  ) {}

  private async uniqueSlug(creatorId: string, title: string, excludeId?: string): Promise<string> {
    const base = slugify(title, 200) || 'article';
    let slug = base;
    let suffix = 1;
    for (;;) {
      const existing = await this.articleRepository.findOne({ where: { creatorId, slug } });
      if (!existing || existing.id === excludeId) return slug;
      suffix += 1;
      slug = `${base}-${suffix}`.slice(0, 220);
    }
  }

  async create(
    creatorId: string,
    input: {
      title: string;
      excerpt?: string;
      bodyMarkdown: string;
      coverImageUrl?: string;
      categoryId?: string;
      visibility?: ArticleVisibility;
      requiredTierId?: string;
    },
  ): Promise<Article> {
    if (!input.title.trim()) throw new BadRequestException('Title is required');
    if (!input.bodyMarkdown.trim()) throw new BadRequestException('Article body is required');
    if (input.bodyMarkdown.length > MAX_BODY_LENGTH) {
      throw new BadRequestException(`Article body exceeds ${MAX_BODY_LENGTH} characters`);
    }

    const title = input.title.trim().slice(0, MAX_TITLE_LENGTH);
    const slug = await this.uniqueSlug(creatorId, title);

    return this.articleRepository.save(
      this.articleRepository.create({
        creatorId,
        title,
        slug,
        excerpt: input.excerpt?.trim().slice(0, MAX_EXCERPT_LENGTH) ?? null,
        bodyMarkdown: input.bodyMarkdown,
        coverImageUrl: input.coverImageUrl ?? null,
        categoryId: input.categoryId ?? null,
        visibility: input.visibility ?? ArticleVisibility.PUBLIC,
        requiredTierId: input.requiredTierId ?? null,
        publishStatus: ArticlePublishStatus.DRAFT,
      }),
    );
  }

  async update(
    creatorId: string,
    articleId: string,
    input: Partial<{
      title: string;
      excerpt: string | null;
      bodyMarkdown: string;
      coverImageUrl: string | null;
      categoryId: string | null;
      visibility: ArticleVisibility;
      requiredTierId: string | null;
    }>,
  ): Promise<Article> {
    const article = await this.findOwned(creatorId, articleId);

    if (input.title !== undefined) {
      const title = input.title.trim().slice(0, MAX_TITLE_LENGTH);
      if (!title) throw new BadRequestException('Title is required');
      if (title !== article.title) {
        article.slug = await this.uniqueSlug(creatorId, title, articleId);
      }
      article.title = title;
    }
    if (input.excerpt !== undefined) {
      article.excerpt = input.excerpt?.trim().slice(0, MAX_EXCERPT_LENGTH) ?? null;
    }
    if (input.bodyMarkdown !== undefined) {
      if (!input.bodyMarkdown.trim()) throw new BadRequestException('Article body is required');
      if (input.bodyMarkdown.length > MAX_BODY_LENGTH) {
        throw new BadRequestException(`Article body exceeds ${MAX_BODY_LENGTH} characters`);
      }
      article.bodyMarkdown = input.bodyMarkdown;
    }
    if (input.coverImageUrl !== undefined) article.coverImageUrl = input.coverImageUrl;
    if (input.categoryId !== undefined) article.categoryId = input.categoryId;
    if (input.visibility !== undefined) article.visibility = input.visibility;
    if ('requiredTierId' in input) article.requiredTierId = input.requiredTierId ?? null;

    return this.articleRepository.save(article);
  }

  async publish(creatorId: string, articleId: string): Promise<Article> {
    const article = await this.findOwned(creatorId, articleId);
    if (article.publishStatus === ArticlePublishStatus.PUBLISHED) return article;
    article.publishStatus = ArticlePublishStatus.PUBLISHED;
    article.publishedAt = new Date();
    return this.articleRepository.save(article);
  }

  async unpublish(creatorId: string, articleId: string): Promise<Article> {
    const article = await this.findOwned(creatorId, articleId);
    article.publishStatus = ArticlePublishStatus.DRAFT;
    return this.articleRepository.save(article);
  }

  async remove(creatorId: string, articleId: string): Promise<{ success: true }> {
    const article = await this.findOwned(creatorId, articleId);
    await this.articleRepository.remove(article);
    return { success: true };
  }

  async listForCreator(
    creatorId: string,
    opts: { page?: unknown; limit?: unknown } = {},
  ): Promise<{ data: Article[] }> {
    const take = clampLimit(opts.limit);
    const skip = (clampPage(opts.page) - 1) * take;
    const data = await this.articleRepository.find({
      where: { creatorId },
      order: { createdAt: 'DESC' },
      take,
      skip,
    });
    return { data };
  }

  async listPublic(
    creatorId: string,
    viewerId: string | null | undefined,
    opts: { page?: unknown; limit?: unknown } = {},
  ): Promise<{ data: Array<Article & { accessible: boolean }> }> {
    if (viewerId && (await this.engagementService.isBlockedEitherWay(viewerId, creatorId))) {
      throw new ForbiddenException('This channel is not available');
    }
    const take = clampLimit(opts.limit);
    const skip = (clampPage(opts.page) - 1) * take;
    const articles = await this.articleRepository.find({
      where: { creatorId, publishStatus: ArticlePublishStatus.PUBLISHED },
      order: { publishedAt: 'DESC' },
      take,
      skip,
    });

    const viewerSub = viewerId
      ? await this.entitlementsService.hasActiveSubscription(viewerId, creatorId)
      : false;

    return {
      data: articles.map((a) => ({ ...a, accessible: this.isAccessible(a, viewerId, viewerSub) })),
    };
  }

  async getBySlug(creatorId: string, slug: string, viewerId?: string | null): Promise<Article> {
    const article = await this.articleRepository.findOne({
      where: { creatorId, slug, publishStatus: ArticlePublishStatus.PUBLISHED },
    });
    if (!article) throw new NotFoundException('Article not found');
    await this.assertAccess(article, viewerId ?? undefined);

    this.articleRepository.increment({ id: article.id }, 'viewCount', 1).catch(() => undefined);
    return article;
  }

  private async assertAccess(article: Article, viewerId?: string): Promise<void> {
    if (article.creatorId === viewerId) return;
    if (viewerId && (await this.engagementService.isBlockedEitherWay(viewerId, article.creatorId))) {
      throw new ForbiddenException('This channel is not available');
    }
    if (article.visibility === ArticleVisibility.PUBLIC) return;

    if (!viewerId) throw new ForbiddenException('Sign in required to read this article');
    const hasSub = await this.entitlementsService.hasActiveSubscription(viewerId, article.creatorId);
    if (!hasSub) throw new ForbiddenException('Subscription required to read this article');

    if (article.visibility === ArticleVisibility.TIER && article.requiredTierId) {
      const hasTier = await this.entitlementsService.hasTierEntitlement(
        viewerId,
        article.creatorId,
        'article' as never,
        article.requiredTierId,
      );
      if (!hasTier) {
        throw new ForbiddenException('Your membership tier does not include this article');
      }
    }
  }

  private isAccessible(
    article: Article,
    viewerId: string | null | undefined,
    viewerSub: boolean,
  ): boolean {
    if (article.visibility === ArticleVisibility.PUBLIC) return true;
    if (!viewerId) return false;
    if (article.creatorId === viewerId) return true;
    return viewerSub;
  }

  private async findOwned(creatorId: string, articleId: string): Promise<Article> {
    const article = await this.articleRepository.findOne({ where: { id: articleId, creatorId } });
    if (!article) throw new NotFoundException('Article not found');
    return article;
  }
}
