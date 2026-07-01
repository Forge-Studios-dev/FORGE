import { Controller, Get, Param, Query, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FeedService, FeedSort } from './feed.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';

function parseListParam(value?: string): string[] | undefined {
  if (!value?.trim()) return undefined;
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

@ApiTags('Feed')
@Controller('videos')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('feed')
  @ApiOperation({ summary: 'Get paginated public video feed' })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'categorySlug', required: false })
  @ApiQuery({ name: 'skillTagIds', required: false, description: 'Comma-separated UUIDs' })
  @ApiQuery({ name: 'skillTagSlugs', required: false, description: 'Comma-separated slugs' })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'sort', required: false, enum: ['latest', 'popular', 'forYou'] })
  getFeed(
    @Query('categoryId') categoryId?: string,
    @Query('categorySlug') categorySlug?: string,
    @Query('skillTagIds') skillTagIds?: string,
    @Query('skillTagSlugs') skillTagSlugs?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Query('sort') sort?: FeedSort,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.feedService.getFeed({
      categoryId,
      categorySlug,
      skillTagIds: parseListParam(skillTagIds),
      skillTagSlugs: parseListParam(skillTagSlugs),
      cursor,
      limit,
      sort,
      userId: user?.sub,
    });
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('feed/trending')
  @ApiOperation({ summary: 'Trending feed (popular sort)' })
  getTrending(
    @Query('categoryId') categoryId?: string,
    @Query('categorySlug') categorySlug?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.feedService.getFeed({
      categoryId,
      categorySlug,
      cursor,
      limit,
      sort: 'popular',
      userId: user?.sub,
    });
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('feed/following')
  @ApiOperation({ summary: 'Feed from followed and subscribed creators' })
  getFollowingFeed(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @CurrentUser() user?: JwtPayload,
  ) {
    if (!user?.sub) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.feedService.getFollowingFeed({
      userId: user.sub,
      cursor,
      limit,
    });
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('feed/recommended')
  @ApiOperation({ summary: 'Personalized recommended feed (forYou sort)' })
  getRecommended(
    @Query('categoryId') categoryId?: string,
    @Query('categorySlug') categorySlug?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.feedService.getFeed({
      categoryId,
      categorySlug,
      cursor,
      limit,
      sort: 'forYou',
      userId: user?.sub,
    });
  }

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'List discoverable public videos (latest feed)' })
  getPublicVideos(
    @Query('categorySlug') categorySlug?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.feedService.getFeed({
      categorySlug,
      cursor,
      limit,
      sort: 'latest',
    });
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/related')
  @ApiOperation({ summary: 'Related / watch-next recommendations for a video' })
  @ApiQuery({ name: 'limit', required: false })
  getRelated(
    @Param('id') id: string,
    @Query('limit') limit?: number,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.feedService.getRelatedVideos({
      videoId: id,
      userId: user?.sub,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Public()
  @Get('by-category/:slug')
  @ApiOperation({ summary: 'Videos in a category by slug' })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'sort', required: false })
  getByCategory(
    @Param('slug') slug: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Query('sort') sort?: FeedSort,
  ) {
    return this.feedService.getFeed({
      categorySlug: slug,
      cursor,
      limit,
      sort: sort ?? 'latest',
    });
  }

  @Public()
  @Get('by-skills')
  @ApiOperation({ summary: 'Videos matching skill tags' })
  @ApiQuery({ name: 'skillTagIds', required: false })
  @ApiQuery({ name: 'skillTagSlugs', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getBySkills(
    @Query('skillTagIds') skillTagIds?: string,
    @Query('skillTagSlugs') skillTagSlugs?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.feedService.getFeed({
      skillTagIds: parseListParam(skillTagIds),
      skillTagSlugs: parseListParam(skillTagSlugs),
      cursor,
      limit,
      sort: 'latest',
    });
  }
}
