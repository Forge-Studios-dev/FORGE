import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { Subcategory } from './entities/subcategory.entity';
import { SkillTag } from './entities/skill-tag.entity';

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
}
