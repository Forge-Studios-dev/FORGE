import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';
import { Subcategory } from './entities/subcategory.entity';
import { SkillTag } from './entities/skill-tag.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Category, Subcategory, SkillTag]),
    // CreatorApprovedGuard (used on the AI tag-suggest route) needs
    // UsersService — forwardRef because AdminModule (plain-imports
    // CategoriesModule) sits between this and UsersModule in the require
    // graph, same pattern as ContentModule's own UsersModule import.
    forwardRef(() => UsersModule),
  ],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
