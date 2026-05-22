import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all categories' })
  findAll() {
    return this.categoriesService.findAll();
  }

  @Public()
  @Get('upload-options')
  @ApiOperation({ summary: 'Categories with skill tags for creator upload' })
  getUploadOptions() {
    return this.categoriesService.getUploadOptions();
  }

  @Public()
  @Get(':id/skill-tags')
  @ApiOperation({ summary: 'Skill tags for a category' })
  getSkillTags(@Param('id') id: string) {
    return this.categoriesService.getSkillTagsForCategory(id);
  }

  @Public()
  @Get(':id/subcategories')
  @ApiOperation({ summary: 'Get subcategories for a category' })
  getSubcategories(@Param('id') id: string) {
    return this.categoriesService.getSubcategories(id);
  }
}

