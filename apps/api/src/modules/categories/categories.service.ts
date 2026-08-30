import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { Subcategory } from './entities/subcategory.entity';
import { SkillTag } from './entities/skill-tag.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

export const CATEGORIES_LIST_CACHE_KEY = 'categories:list';
export const CATEGORIES_UPLOAD_CACHE_KEY = 'categories:upload-options';
export const CATEGORIES_CACHE_TTL_SEC = 15 * 60;

type UploadOption = {
  id: string;
  name: string;
  slug: string;
  skillTags: Array<{ id: string; name: string; slug: string }>;
};

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Subcategory)
    private readonly subcategoryRepository: Repository<Subcategory>,
    @InjectRepository(SkillTag)
    private readonly skillTagRepository: Repository<SkillTag>,
    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  async findAll(): Promise<Category[]> {
    const cached = await this.readCache<Category[]>(CATEGORIES_LIST_CACHE_KEY);
    if (cached) return cached;
    const rows = await this.categoryRepository.find({ order: { sortOrder: 'ASC' } });
    await this.writeCache(CATEGORIES_LIST_CACHE_KEY, rows);
    return rows;
  }

  async findById(id: string): Promise<Category> {
    const cat = await this.categoryRepository.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  async findBySlug(slug: string): Promise<Category> {
    const cat = await this.categoryRepository.findOne({ where: { slug } });
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  async getSubcategories(categoryId: string): Promise<Subcategory[]> {
    await this.findById(categoryId);
    return this.subcategoryRepository.find({ where: { categoryId }, order: { name: 'ASC' } });
  }

  async getSkillsBySubcategory(subcategoryId: string): Promise<SkillTag[]> {
    return this.skillTagRepository.find({
      where: { subcategoryId },
      order: { name: 'ASC' },
    });
  }

  /** All skill tags for a category (for upload picker). */
  async getSkillTagsForCategory(categoryId: string): Promise<SkillTag[]> {
    await this.findById(categoryId);
    return this.skillTagRepository
      .createQueryBuilder('tag')
      .innerJoin('tag.subcategory', 'sub')
      .where('sub.categoryId = :categoryId', { categoryId })
      .orderBy('tag.name', 'ASC')
      .getMany();
  }

  /** Categories with nested skill tags for the upload flow. */
  async getUploadOptions(): Promise<UploadOption[]> {
    const cached = await this.readCache<UploadOption[]>(CATEGORIES_UPLOAD_CACHE_KEY);
    if (cached) return cached;

    const categories = await this.categoryRepository
      .createQueryBuilder('cat')
      .leftJoinAndSelect('cat.subcategories', 'sub')
      .leftJoinAndSelect('sub.skillTags', 'tag')
      .orderBy('cat.sortOrder', 'ASC')
      .addOrderBy('tag.name', 'ASC')
      .getMany();

    const result: UploadOption[] = categories.map((cat) => {
      const skillTags: UploadOption['skillTags'] = [];
      const seen = new Set<string>();
      for (const sub of cat.subcategories ?? []) {
        for (const tag of sub.skillTags ?? []) {
          if (seen.has(tag.id)) continue;
          seen.add(tag.id);
          skillTags.push({ id: tag.id, name: tag.name, slug: tag.slug });
        }
      }
      return { id: cat.id, name: cat.name, slug: cat.slug, skillTags };
    });

    await this.writeCache(CATEGORIES_UPLOAD_CACHE_KEY, result);
    return result;
  }

  /**
   * AI content tagging: rank a category's curated skill tags by relevance to
   * the supplied title/description. Deterministic and bounded by the number of
   * tags in the category (no external LLM cost). Suggestions are advisory — the
   * upload flow still validates the chosen tag IDs.
   */
  async suggestSkillTags(
    categoryId: string,
    title: string,
    description?: string,
    limit = 5,
  ): Promise<Array<{ id: string; name: string; slug: string; score: number }>> {
    const tags = await this.getSkillTagsForCategory(categoryId);
    if (!tags.length) return [];

    const text = `${title ?? ''} ${description ?? ''}`.toLowerCase();
    const textTokens = new Set(text.split(/[^a-z0-9]+/).filter((t) => t.length >= 3));
    if (!textTokens.size) return [];

    const scored = tags.map((tag) => {
      const name = tag.name.toLowerCase();
      const nameTokens = [
        ...new Set(
          `${name} ${tag.slug.replace(/-/g, ' ')}`
            .split(/[^a-z0-9]+/)
            .filter((t) => t.length >= 3),
        ),
      ];
      let score = 0;
      // Strong signal: the full tag name appears as a phrase in the content.
      if (name.length >= 3 && text.includes(name)) score += 1;
      // Token overlap: fraction of tag tokens present in the content.
      if (nameTokens.length) {
        const hits = nameTokens.filter((t) => textTokens.has(t)).length;
        score += hits / nameTokens.length;
      }
      return {
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        score: Math.round(score * 100) / 100,
      };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    const existing = await this.categoryRepository.findOne({
      where: [{ slug: dto.slug }, { name: dto.name }],
    });
    if (existing) throw new ConflictException('Category name or slug already exists');
    const category = this.categoryRepository.create();
    category.name = dto.name;
    category.slug = dto.slug;
    category.description = dto.description ?? null;
    category.iconUrl = dto.iconUrl ?? null;
    category.sortOrder = dto.sortOrder ?? 0;
    const saved = await this.categoryRepository.save(category);
    await this.bustCategoryCaches();
    return saved;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findById(id);
    if (dto.slug && dto.slug !== category.slug) {
      const slugTaken = await this.categoryRepository.findOne({ where: { slug: dto.slug } });
      if (slugTaken && slugTaken.id !== id) throw new ConflictException('Slug already in use');
    }
    if (dto.name && dto.name !== category.name) {
      const nameTaken = await this.categoryRepository.findOne({ where: { name: dto.name } });
      if (nameTaken && nameTaken.id !== id) throw new ConflictException('Name already in use');
    }
    Object.assign(category, {
      ...dto,
      description: dto.description !== undefined ? dto.description : category.description,
      iconUrl: dto.iconUrl !== undefined ? dto.iconUrl : category.iconUrl,
    });
    const saved = await this.categoryRepository.save(category);
    await this.bustCategoryCaches();
    return saved;
  }

  async remove(id: string): Promise<{ ok: true }> {
    await this.findById(id);
    const subCount = await this.subcategoryRepository.count({ where: { categoryId: id } });
    if (subCount > 0) {
      throw new ConflictException('Cannot delete category with subcategories');
    }
    await this.categoryRepository.delete(id);
    await this.bustCategoryCaches();
    return { ok: true };
  }

  private async readCache<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.warn(`Category cache read failed: ${(err as Error).message}`);
      return null;
    }
  }

  private async writeCache(key: string, value: unknown): Promise<void> {
    try {
      await this.redis.setex(key, CATEGORIES_CACHE_TTL_SEC, JSON.stringify(value));
    } catch (err) {
      this.logger.warn(`Category cache write failed: ${(err as Error).message}`);
    }
  }

  private async bustCategoryCaches(): Promise<void> {
    try {
      await this.redis.del(CATEGORIES_LIST_CACHE_KEY, CATEGORIES_UPLOAD_CACHE_KEY);
    } catch (err) {
      this.logger.warn(`Category cache bust failed: ${(err as Error).message}`);
    }
  }
}
