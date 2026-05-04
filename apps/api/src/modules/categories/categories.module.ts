import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';
import { Subcategory } from './entities/subcategory.entity';
import { SkillTag } from './entities/skill-tag.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Category, Subcategory, SkillTag])],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
