import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ArticlesService } from './articles.service';
import { Article, ArticlePublishStatus, ArticleVisibility } from './entities/article.entity';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { EngagementService } from '../engagement/engagement.service';

describe('ArticlesService', () => {
  let service: ArticlesService;

  const mockArticle: Article = {
    id: 'article-1',
    creatorId: 'creator-1',
    title: 'My Article',
    slug: 'my-article',
    excerpt: null,
    bodyMarkdown: 'Hello world',
    coverImageUrl: null,
    categoryId: null,
    visibility: ArticleVisibility.PUBLIC,
    requiredTierId: null,
    publishStatus: ArticlePublishStatus.DRAFT,
    viewCount: 0,
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const articleRepository = {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([mockArticle]),
    save: jest.fn(async (entity: Partial<Article>) => ({ ...mockArticle, ...entity })),
    create: jest.fn((dto: Partial<Article>) => dto),
    remove: jest.fn().mockResolvedValue(undefined),
    increment: jest.fn().mockResolvedValue(undefined),
  };

  const entitlementsService = {
    hasActiveSubscription: jest.fn().mockResolvedValue(false),
    hasTierEntitlement: jest.fn().mockResolvedValue(false),
  };

  const engagementService = {
    isBlockedEitherWay: jest.fn().mockResolvedValue(false),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    articleRepository.findOne.mockReset();
    articleRepository.find.mockResolvedValue([mockArticle]);
    entitlementsService.hasActiveSubscription.mockResolvedValue(false);
    engagementService.isBlockedEitherWay.mockResolvedValue(false);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticlesService,
        { provide: getRepositoryToken(Article), useValue: articleRepository },
        { provide: EntitlementsService, useValue: entitlementsService },
        { provide: EngagementService, useValue: engagementService },
      ],
    }).compile();

    service = module.get(ArticlesService);
  });

  describe('create', () => {
    it('rejects an empty title', async () => {
      await expect(
        service.create('creator-1', { title: '  ', bodyMarkdown: 'body' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an empty body', async () => {
      await expect(
        service.create('creator-1', { title: 'Title', bodyMarkdown: '  ' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a draft with a slugified slug', async () => {
      articleRepository.findOne.mockResolvedValue(null);
      const result = await service.create('creator-1', {
        title: 'My New Article!',
        bodyMarkdown: 'Body text',
      });
      expect(result.slug).toBe('my-new-article');
      expect(result.publishStatus).toBe(ArticlePublishStatus.DRAFT);
    });

    it('disambiguates a duplicate slug for the same creator', async () => {
      articleRepository.findOne
        .mockResolvedValueOnce(mockArticle)
        .mockResolvedValueOnce(null);
      const result = await service.create('creator-1', {
        title: 'My Article',
        bodyMarkdown: 'Body text',
      });
      expect(result.slug).toBe('my-article-2');
    });
  });

  describe('publish/unpublish', () => {
    it('sets publishStatus and publishedAt on publish', async () => {
      articleRepository.findOne.mockResolvedValue({ ...mockArticle });
      const result = await service.publish('creator-1', 'article-1');
      expect(result.publishStatus).toBe(ArticlePublishStatus.PUBLISHED);
      expect(result.publishedAt).toBeInstanceOf(Date);
    });

    it('throws when article not owned', async () => {
      articleRepository.findOne.mockResolvedValue(null);
      await expect(service.publish('creator-1', 'nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getBySlug / access control', () => {
    it('returns a public published article to anyone', async () => {
      articleRepository.findOne.mockResolvedValue({
        ...mockArticle,
        publishStatus: ArticlePublishStatus.PUBLISHED,
      });
      const result = await service.getBySlug('creator-1', 'my-article', undefined);
      expect(result.id).toBe('article-1');
    });

    it('404s a draft article', async () => {
      articleRepository.findOne.mockResolvedValue(null);
      await expect(service.getBySlug('creator-1', 'my-article', 'viewer-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('requires sign-in for a subscriber-gated article', async () => {
      articleRepository.findOne.mockResolvedValue({
        ...mockArticle,
        visibility: ArticleVisibility.SUBSCRIBERS,
        publishStatus: ArticlePublishStatus.PUBLISHED,
      });
      await expect(service.getBySlug('creator-1', 'my-article', undefined)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects a signed-in non-subscriber from a subscriber-gated article', async () => {
      articleRepository.findOne.mockResolvedValue({
        ...mockArticle,
        visibility: ArticleVisibility.SUBSCRIBERS,
        publishStatus: ArticlePublishStatus.PUBLISHED,
      });
      entitlementsService.hasActiveSubscription.mockResolvedValue(false);
      await expect(service.getBySlug('creator-1', 'my-article', 'viewer-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows a subscriber to read a subscriber-gated article', async () => {
      articleRepository.findOne.mockResolvedValue({
        ...mockArticle,
        visibility: ArticleVisibility.SUBSCRIBERS,
        publishStatus: ArticlePublishStatus.PUBLISHED,
      });
      entitlementsService.hasActiveSubscription.mockResolvedValue(true);
      const result = await service.getBySlug('creator-1', 'my-article', 'viewer-1');
      expect(result.id).toBe('article-1');
    });

    it('always allows the creator to read their own gated article', async () => {
      articleRepository.findOne.mockResolvedValue({
        ...mockArticle,
        visibility: ArticleVisibility.SUBSCRIBERS,
        publishStatus: ArticlePublishStatus.PUBLISHED,
      });
      const result = await service.getBySlug('creator-1', 'my-article', 'creator-1');
      expect(result.id).toBe('article-1');
    });

    it('blocks a reader blocked by the creator', async () => {
      articleRepository.findOne.mockResolvedValue({
        ...mockArticle,
        publishStatus: ArticlePublishStatus.PUBLISHED,
      });
      engagementService.isBlockedEitherWay.mockResolvedValue(true);
      await expect(service.getBySlug('creator-1', 'my-article', 'viewer-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
