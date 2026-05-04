import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FeedService } from './feed.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('Feed')
@Controller('videos/feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get paginated video feed' })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getFeed(
    @Query('categoryId') categoryId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.feedService.getFeed({ categoryId, cursor, limit, userId: user?.sub });
  }
}
