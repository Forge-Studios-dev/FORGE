import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { Public } from '../../common/decorators/public.decorator';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { SuggestTagsDto } from './dto/suggest-tags.dto';

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

  @Post(':id/ai/suggest-tags')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'AI-suggested skill tags from a draft title/description' })
  async suggestTags(@Param('id') id: string, @Body() body: SuggestTagsDto) {
    return {
      data: await this.categoriesService.suggestSkillTags(id, body.title, body.description),
    };
  }
}

