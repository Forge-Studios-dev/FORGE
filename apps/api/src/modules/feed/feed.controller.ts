import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FeedService, FeedSort } from './feed.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';

@ApiTags('Feed')
@Controller('videos/feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Get paginated video feed' })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'categorySlug', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'sort', required: false, enum: ['latest', 'popular', 'forYou'] })
  getFeed(
    @Query('categoryId') categoryId?: string,
    @Query('categorySlug') categorySlug?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Query('sort') sort?: FeedSort,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.feedService.getFeed({
      categoryId,
      categorySlug,
      cursor,
      limit,
      sort,
      userId: user?.sub,
    });
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('trending')
  @ApiOperation({ summary: 'Trending feed (MVP: same as popular sort)' })
  getTrending(
    @Query('categoryId') categoryId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.feedService.getFeed({
      categoryId,
      cursor,
      limit,
      sort: 'popular',
      userId: user?.sub,
    });
  }
}
