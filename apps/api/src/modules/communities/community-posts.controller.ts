import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommunityPostsService } from './community-posts.service';
import { CommunityPostType } from './entities/community-post.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Public } from '../../common/decorators/public.decorator';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';

@ApiTags('Community Posts')
@Controller()
export class CommunityPostsController {
  constructor(private readonly postsService: CommunityPostsService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('communities/:communityId/posts')
  @ApiOperation({ summary: 'List community posts' })
  list(
    @Param('communityId') communityId: string,
    @Query('limit') limit = 30,
    @Query('cursor') cursor?: string,
  ) {
    return this.postsService.listPosts(communityId, Number(limit) || 30, cursor);
  }

  @Public()
  @Get('communities/:communityId/posts/search')
  @ApiOperation({ summary: 'Search community posts' })
  search(@Param('communityId') communityId: string, @Query('q') q = '') {
    return this.postsService.searchPosts(communityId, q);
  }

  @Post('creators/me/communities/:communityId/posts')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Create a community post or announcement' })
  create(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Body()
    body: { title?: string; body: string; postType?: CommunityPostType; isPinned?: boolean },
  ) {
    return this.postsService.createPost(user.sub, communityId, user.sub, body);
  }
}
