import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ArticlesService } from './articles.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { ArticleVisibility } from './entities/article.entity';

class CreateArticleDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  bodyMarkdown: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ enum: ArticleVisibility })
  @IsOptional()
  @IsEnum(ArticleVisibility)
  visibility?: ArticleVisibility;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  requiredTierId?: string;
}

class UpdateArticleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  bodyMarkdown?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ enum: ArticleVisibility })
  @IsOptional()
  @IsEnum(ArticleVisibility)
  visibility?: ArticleVisibility;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  requiredTierId?: string;
}

@ApiTags('Articles')
@Controller()
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Post('creators/me/articles')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Create a draft article' })
  create(@CurrentUser() user: JwtPayload, @Body() body: CreateArticleDto) {
    return this.articlesService.create(user.sub, body);
  }

  @Patch('creators/me/articles/:articleId')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Update an article (draft or published)' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Body() body: UpdateArticleDto,
  ) {
    return this.articlesService.update(user.sub, articleId, body);
  }

  @Post('creators/me/articles/:articleId/publish')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Publish a draft article' })
  publish(@CurrentUser() user: JwtPayload, @Param('articleId', ParseUUIDPipe) articleId: string) {
    return this.articlesService.publish(user.sub, articleId);
  }

  @Post('creators/me/articles/:articleId/unpublish')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Unpublish an article back to draft' })
  unpublish(@CurrentUser() user: JwtPayload, @Param('articleId', ParseUUIDPipe) articleId: string) {
    return this.articlesService.unpublish(user.sub, articleId);
  }

  @Delete('creators/me/articles/:articleId')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Delete an article' })
  remove(@CurrentUser() user: JwtPayload, @Param('articleId', ParseUUIDPipe) articleId: string) {
    return this.articlesService.remove(user.sub, articleId);
  }

  @Get('creators/me/articles')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'List all my articles, including drafts (studio)' })
  listForCreator(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.articlesService.listForCreator(user.sub, { page, limit });
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('creators/:creatorId/articles')
  @ApiOperation({ summary: 'List a creator\'s published articles (consumer)' })
  listPublic(
    @Param('creatorId', ParseUUIDPipe) creatorId: string,
    @CurrentUser() user?: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.articlesService.listPublic(creatorId, user?.sub, { page, limit });
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('creators/:creatorId/articles/:slug')
  @ApiOperation({ summary: 'Read a published article by slug (access-checked)' })
  getBySlug(
    @Param('creatorId', ParseUUIDPipe) creatorId: string,
    @Param('slug') slug: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.articlesService.getBySlug(creatorId, slug, user?.sub);
  }
}
