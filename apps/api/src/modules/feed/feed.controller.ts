import { Controller, Get, Param, ParseUUIDPipe, Query, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FeedService, FeedSort } from './feed.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';

@ApiTags('Feed')
@Controller('videos')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  // NOTE: `feed`, `public`, and `by-skills` (single path segment, no suffix)
  // are handled by VideosController instead of here — VideosController also
  // owns an unconstrained `:id` GET route under this same `videos` prefix
  // (path-to-regexp v7 / Express 5 dropped inline regex param constraints),
  // and FeedModule imports ContentModule, which means ContentModule always
  // initializes first regardless of app.module.ts import order, so
  // VideosController's routes always register before FeedController's.
  // Declaring these three here would be silently unreachable — see
  // videos.controller.ts and route-shadow-order.spec.ts.

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
  @ApiQuery({ name: 'channelId', required: false, description: 'Filter to one subscribed channel' })
  getFollowingFeed(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Query('channelId') channelId?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    if (!user?.sub) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.feedService.getFollowingFeed({
      userId: user.sub,
      cursor,
      limit,
      channelId: channelId?.trim() || undefined,
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
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/related')
  @ApiOperation({ summary: 'Related / watch-next recommendations for a video' })
  @ApiQuery({ name: 'limit', required: false })
  getRelated(
    @Param('id', ParseUUIDPipe) id: string,
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
  @UseGuards(OptionalJwtAuthGuard)
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
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.feedService.getFeed({
      categorySlug: slug,
      cursor,
      limit,
      sort: sort ?? 'latest',
      userId: user?.sub,
    });
  }
}
