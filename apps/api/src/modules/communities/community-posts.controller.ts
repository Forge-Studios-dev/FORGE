import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommunityPostsService } from './community-posts.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Public } from '../../common/decorators/public.decorator';
import { CommunityStudioGuard } from './guards/community-studio.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import {
  CreateCommunityPostCommentDto,
  CreateCommunityPostDto,
  PinCommunityPostDto,
  UpdateCommunityPostDto,
} from './dto/community-post.dto';

@ApiTags('Community Posts')
@Controller()
export class CommunityPostsController {
  constructor(private readonly postsService: CommunityPostsService) {}

  @Get('me/community-updates')
  @ApiOperation({ summary: 'Creator updates feed — announcements across joined communities' })
  updatesFeed(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit = 20,
    @Query('cursor') cursor?: string,
  ) {
    return this.postsService.getMemberUpdatesFeed(user.sub, Number(limit) || 20, cursor);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('creators/:creatorId/channel-posts')
  @ApiOperation({
    summary: 'YouTube-style channel Community feed (public posts across creator communities)',
  })
  listChannelPosts(
    @Param('creatorId', ParseUUIDPipe) creatorId: string,
    @Query('limit') limit = 20,
    @Query('cursor') cursor?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.postsService.listChannelPostsForCreator(
      creatorId,
      Number(limit) || 20,
      cursor,
      user?.sub,
    );
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('communities/:communityId/posts')
  @ApiOperation({ summary: 'List community posts' })
  list(
    @Param('communityId', ParseUUIDPipe) communityId: string,
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
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Query('q') q = '',
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.postsService.searchPosts(communityId, q, 20, user?.sub, user?.role);
  }

  @Post('creators/me/channel-posts')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({
    summary: 'Create a YouTube-style channel Community post (default public community)',
  })
  createChannelPost(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateCommunityPostDto,
  ) {
    return this.postsService.createChannelPost(user.sub, body, user.role);
  }

  @Post('creators/me/channel-posts/media-upload-url')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Presigned URL for channel Community post image' })
  channelPostMediaUploadUrl(
    @CurrentUser() user: JwtPayload,
    @Query('contentType') contentType: string,
  ) {
    return this.postsService.getChannelPostMediaUploadUrl(
      user.sub,
      contentType || 'image/jpeg',
      user.role,
    );
  }

  @Post('creators/me/communities/:communityId/posts')
  @UseGuards(CommunityStudioGuard)
  @ApiOperation({ summary: 'Create a community post or announcement' })
  create(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Body() body: CreateCommunityPostDto,
  ) {
    return this.postsService.createPost(user.sub, communityId, user.sub, body, user.role);
  }

  @Post('creators/me/communities/:communityId/posts/media-upload-url')
  @UseGuards(CommunityStudioGuard)
  @ApiOperation({ summary: 'Presigned URL for community post image upload' })
  postMediaUploadUrl(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Query('contentType') contentType: string,
  ) {
    return this.postsService.getMediaUploadUrl(
      user.sub,
      communityId,
      contentType || 'image/jpeg',
      user.role,
    );
  }

  @Patch('creators/me/communities/:communityId/posts/:postId')
  @UseGuards(CommunityStudioGuard)
  @ApiOperation({ summary: 'Update a community post' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() body: UpdateCommunityPostDto,
  ) {
    return this.postsService.updatePost(user.sub, communityId, postId, body, user.role);
  }

  @Delete('creators/me/communities/:communityId/posts/:postId')
  @UseGuards(CommunityStudioGuard)
  @ApiOperation({ summary: 'Delete a community post' })
  delete(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
  ) {
    return this.postsService.deletePost(user.sub, communityId, postId, user.role);
  }

  @Post('creators/me/communities/:communityId/posts/:postId/pin')
  @UseGuards(CommunityStudioGuard)
  @ApiOperation({ summary: 'Pin or unpin a community post' })
  pin(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() body: PinCommunityPostDto,
  ) {
    return this.postsService.setPostPinned(
      user.sub,
      communityId,
      postId,
      body.isPinned,
      user.role,
    );
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('communities/:communityId/posts/:postId/comments')
  @ApiOperation({ summary: 'List comments on a community post' })
  listComments(
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.postsService.listComments(communityId, postId, user?.sub, user?.role);
  }

  @Post('communities/:communityId/posts/:postId/comments')
  @ApiOperation({ summary: 'Add a comment to a community post' })
  createComment(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() body: CreateCommunityPostCommentDto,
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
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
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
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
  ) {
    return this.postsService.toggleReaction(communityId, postId, user.sub, user.role);
  }

  @Patch('communities/:communityId/posts/:postId/accept-answer/:commentId')
  @ApiOperation({ summary: 'Mark a comment as the accepted answer for a Q&A post' })
  acceptAnswer(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    return this.postsService.acceptAnswer(communityId, postId, commentId, user.sub);
  }
}
