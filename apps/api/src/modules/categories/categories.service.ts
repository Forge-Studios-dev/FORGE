import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { Subcategory } from './entities/subcategory.entity';
import { SkillTag } from './entities/skill-tag.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Subcategory)
    private readonly subcategoryRepository: Repository<Subcategory>,
    @InjectRepository(SkillTag)
    private readonly skillTagRepository: Repository<SkillTag>,
  ) {}

  findAll(): Promise<Category[]> {
    return this.categoryRepository.find({ order: { sortOrder: 'ASC' } });
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
    return this.categoryRepository.save(category);
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
    return this.categoryRepository.save(category);
  }

  async remove(id: string): Promise<{ ok: true }> {
    await this.findById(id);
    const subCount = await this.subcategoryRepository.count({ where: { categoryId: id } });
    if (subCount > 0) {
      throw new ConflictException('Cannot delete category with subcategories');
    }
    await this.categoryRepository.delete(id);
    return { ok: true };
  }
}
