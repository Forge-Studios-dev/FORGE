import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import { CategoriesService, CATEGORIES_LIST_CACHE_KEY, CATEGORIES_UPLOAD_CACHE_KEY } from './categories.service';
import { Category } from './entities/category.entity';
import { Subcategory } from './entities/subcategory.entity';
import { SkillTag } from './entities/skill-tag.entity';

describe('CategoriesService', () => {
  let service: CategoriesService;

  const tagQb = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  const catQb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  const redis = {
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  };

  const categoryRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(() => ({}) as Category),
    save: jest.fn(async (c: Partial<Category>) => ({ id: 'cat-1', ...c })),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => catQb),
  };
  const subcategoryRepository = {
    find: jest.fn(),
    count: jest.fn(),
  };
  const skillTagRepository = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(() => tagQb),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: getRepositoryToken(Category), useValue: categoryRepository },
        { provide: getRepositoryToken(Subcategory), useValue: subcategoryRepository },
        { provide: getRepositoryToken(SkillTag), useValue: skillTagRepository },
        { provide: getRedisConnectionToken(), useValue: redis },
      ],
    }).compile();
    service = module.get(CategoriesService);
  });

  describe('findById / findBySlug', () => {
    it('returns a category by id', async () => {
      categoryRepository.findOne.mockResolvedValue({ id: 'cat-1' });
      await expect(service.findById('cat-1')).resolves.toEqual({ id: 'cat-1' });
    });

    it('throws when id missing', async () => {
      categoryRepository.findOne.mockResolvedValue(null);
      await expect(service.findById('nope')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when slug missing', async () => {
      categoryRepository.findOne.mockResolvedValue(null);
      await expect(service.findBySlug('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getSubcategories', () => {
    it('validates the parent category exists first', async () => {
      categoryRepository.findOne.mockResolvedValue(null);
      await expect(service.getSubcategories('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(subcategoryRepository.find).not.toHaveBeenCalled();
    });

    it('lists subcategories for a valid category', async () => {
      categoryRepository.findOne.mockResolvedValue({ id: 'cat-1' });
      subcategoryRepository.find.mockResolvedValue([{ id: 'sub-1' }]);
      const result = await service.getSubcategories('cat-1');
      expect(subcategoryRepository.find).toHaveBeenCalledWith({
        where: { categoryId: 'cat-1' },
        order: { name: 'ASC' },
      });
      expect(result).toEqual([{ id: 'sub-1' }]);
    });
  });

  describe('findAll', () => {
    it('returns cached categories without hitting the database', async () => {
      const cached = [{ id: 'cat-1', name: 'Tech', slug: 'tech' }];
      redis.get.mockResolvedValueOnce(JSON.stringify(cached));
      const result = await service.findAll();
      expect(result).toEqual(cached);
      expect(categoryRepository.find).not.toHaveBeenCalled();
    });

    it('loads from the database and writes the cache on a miss', async () => {
      const rows = [{ id: 'cat-1', name: 'Tech', slug: 'tech' }];
      categoryRepository.find.mockResolvedValue(rows);
      const result = await service.findAll();
      expect(result).toEqual(rows);
      expect(redis.setex).toHaveBeenCalledWith(
        CATEGORIES_LIST_CACHE_KEY,
        15 * 60,
        JSON.stringify(rows),
      );
    });
  });

  describe('getUploadOptions', () => {
    it('returns categories with nested skill tags from a single join query', async () => {
      catQb.getMany.mockResolvedValue([
        {
          id: 'cat-1',
          name: 'Tech',
          slug: 'tech',
          subcategories: [{ skillTags: [{ id: 'tag-1', name: 'React', slug: 'react' }] }],
        },
      ]);
      const result = await service.getUploadOptions();
      expect(categoryRepository.createQueryBuilder).toHaveBeenCalledWith('cat');
      expect(result).toEqual([
        {
          id: 'cat-1',
          name: 'Tech',
          slug: 'tech',
          skillTags: [{ id: 'tag-1', name: 'React', slug: 'react' }],
        },
      ]);
      expect(skillTagRepository.createQueryBuilder).not.toHaveBeenCalled();
      expect(redis.setex).toHaveBeenCalledWith(
        CATEGORIES_UPLOAD_CACHE_KEY,
        15 * 60,
        expect.any(String),
      );
    });

    it('returns cached upload options without hitting the database', async () => {
      const cached = [{ id: 'cat-1', name: 'Tech', slug: 'tech', skillTags: [] }];
      redis.get.mockResolvedValueOnce(JSON.stringify(cached));
      const result = await service.getUploadOptions();
      expect(result).toEqual(cached);
      expect(categoryRepository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('suggestSkillTags', () => {
    const catalog = [
      { id: 't-react', name: 'React', slug: 'react' },
      { id: 't-vue', name: 'Vue', slug: 'vue' },
      { id: 't-state', name: 'State Management', slug: 'state-management' },
      { id: 't-py', name: 'Python', slug: 'python' },
    ];

    beforeEach(() => {
      categoryRepository.findOne.mockResolvedValue({ id: 'cat-1' });
      tagQb.getMany.mockResolvedValue(catalog);
    });

    it('ranks tags matching the title/description first', async () => {
      const result = await service.suggestSkillTags(
        'cat-1',
        'Building a React hooks tutorial',
        'Covers advanced state management patterns in React',
      );
      expect(result[0].id).toBe('t-react');
      const ids = result.map((r) => r.id);
      expect(ids).toContain('t-state');
      expect(ids).not.toContain('t-py');
      expect(result.every((r) => r.score > 0)).toBe(true);
    });

    it('returns an empty list when nothing matches', async () => {
      const result = await service.suggestSkillTags('cat-1', 'Gardening basics', 'soil and seeds');
      expect(result).toEqual([]);
    });

    it('returns an empty list when the category has no tags', async () => {
      tagQb.getMany.mockResolvedValue([]);
      const result = await service.suggestSkillTags('cat-1', 'React tutorial', 'hooks');
      expect(result).toEqual([]);
    });

    it('respects the limit', async () => {
      const result = await service.suggestSkillTags(
        'cat-1',
        'React Vue Python state management',
        '',
        2,
      );
      expect(result.length).toBe(2);
    });
  });

  describe('create', () => {
    it('rejects duplicate name or slug', async () => {
      categoryRepository.findOne.mockResolvedValue({ id: 'existing' });
      await expect(
        service.create({ name: 'Tech', slug: 'tech' } as never),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates a new category with defaults', async () => {
      categoryRepository.findOne.mockResolvedValue(null);
      const result = await service.create({ name: 'Tech', slug: 'tech' } as never);
      expect(categoryRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Tech', slug: 'tech', sortOrder: 0 }),
      );
      expect(result.id).toBe('cat-1');
      expect(redis.del).toHaveBeenCalledWith(CATEGORIES_LIST_CACHE_KEY, CATEGORIES_UPLOAD_CACHE_KEY);
    });
  });

  describe('update', () => {
    it('rejects when new slug collides with another category', async () => {
      categoryRepository.findOne
        .mockResolvedValueOnce({ id: 'cat-1', slug: 'old', name: 'Old' })
        .mockResolvedValueOnce({ id: 'cat-2', slug: 'taken' });
      await expect(service.update('cat-1', { slug: 'taken' } as never)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rejects when new name collides with another category', async () => {
      categoryRepository.findOne
        .mockResolvedValueOnce({ id: 'cat-1', slug: 'slug', name: 'Old' })
        .mockResolvedValueOnce({ id: 'cat-2', name: 'Taken' });
      await expect(service.update('cat-1', { name: 'Taken' } as never)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('saves updated fields when no collisions', async () => {
      categoryRepository.findOne.mockResolvedValueOnce({
        id: 'cat-1',
        slug: 'slug',
        name: 'Old',
        description: 'd',
        iconUrl: null,
      });
      const result = await service.update('cat-1', { description: 'new desc' } as never);
      expect(categoryRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'new desc' }),
      );
      expect(result.id).toBe('cat-1');
      expect(redis.del).toHaveBeenCalledWith(CATEGORIES_LIST_CACHE_KEY, CATEGORIES_UPLOAD_CACHE_KEY);
    });
    it('throws when category missing', async () => {
      categoryRepository.findOne.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('blocks deleting a category with subcategories', async () => {
      categoryRepository.findOne.mockResolvedValue({ id: 'cat-1' });
      subcategoryRepository.count.mockResolvedValue(2);
      await expect(service.remove('cat-1')).rejects.toBeInstanceOf(ConflictException);
      expect(categoryRepository.delete).not.toHaveBeenCalled();
    });

    it('deletes an empty category', async () => {
      categoryRepository.findOne.mockResolvedValue({ id: 'cat-1' });
      subcategoryRepository.count.mockResolvedValue(0);
      categoryRepository.delete.mockResolvedValue({ affected: 1 });
      const result = await service.remove('cat-1');
      expect(categoryRepository.delete).toHaveBeenCalledWith('cat-1');
      expect(result).toEqual({ ok: true });
      expect(redis.del).toHaveBeenCalledWith(CATEGORIES_LIST_CACHE_KEY, CATEGORIES_UPLOAD_CACHE_KEY);
    });
  });
});
