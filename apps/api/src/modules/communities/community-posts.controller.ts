import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.postsService.listPosts(
      communityId,
      Number(limit) || 30,
      cursor,
      user?.sub,
      user?.role,
    );
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('communities/:communityId/posts/search')
  @ApiOperation({ summary: 'Search community posts' })
  search(
    @Param('communityId') communityId: string,
    @Query('q') q = '',
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.postsService.searchPosts(communityId, q, 20, user?.sub, user?.role);
  }

  @Post('creators/me/communities/:communityId/posts')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Create a community post or announcement' })
  create(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Body()
    body: {
      title?: string;
      body: string;
      postType?: CommunityPostType;
      isPinned?: boolean;
      mediaUrls?: string[];
    },
  ) {
    return this.postsService.createPost(user.sub, communityId, user.sub, body);
  }

  @Post('creators/me/communities/:communityId/posts/media-upload-url')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Presigned URL for community post image upload' })
  postMediaUploadUrl(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Query('contentType') contentType: string,
  ) {
    return this.postsService.getMediaUploadUrl(user.sub, communityId, contentType || 'image/jpeg');
  }

  @Patch('creators/me/communities/:communityId/posts/:postId')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Update a community post' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('postId') postId: string,
    @Body() body: { title?: string; body?: string; isPinned?: boolean },
  ) {
    return this.postsService.updatePost(user.sub, communityId, postId, body);
  }

  @Delete('creators/me/communities/:communityId/posts/:postId')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Delete a community post' })
  delete(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('postId') postId: string,
  ) {
    return this.postsService.deletePost(user.sub, communityId, postId);
  }

  @Post('creators/me/communities/:communityId/posts/:postId/pin')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Pin or unpin a community post' })
  pin(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('postId') postId: string,
    @Body() body: { isPinned: boolean },
  ) {
    return this.postsService.setPostPinned(user.sub, communityId, postId, body.isPinned);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('communities/:communityId/posts/:postId/comments')
  @ApiOperation({ summary: 'List comments on a community post' })
  listComments(
    @Param('communityId') communityId: string,
    @Param('postId') postId: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.postsService.listComments(communityId, postId, user?.sub, user?.role);
  }

  @Post('communities/:communityId/posts/:postId/comments')
  @ApiOperation({ summary: 'Add a comment to a community post' })
  createComment(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('postId') postId: string,
    @Body() body: { body: string; parentId?: string },
  ) {
    return this.postsService.createComment(
      communityId,
      postId,
      user.sub,
      body,
      user.role,
    );
  }

  @Delete('communities/:communityId/posts/:postId/comments/:commentId')
  @ApiOperation({ summary: 'Delete a comment on a community post' })
  deleteComment(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
  ) {
    return this.postsService.deleteComment(
      communityId,
      postId,
      commentId,
      user.sub,
      user.role,
    );
  }

  @Post('communities/:communityId/posts/:postId/reactions')
  @ApiOperation({ summary: 'Toggle like reaction on a community post' })
  toggleReaction(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('postId') postId: string,
  ) {
    return this.postsService.toggleReaction(communityId, postId, user.sub, user.role);
  }
}
