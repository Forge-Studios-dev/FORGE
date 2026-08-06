import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EngagementService } from './engagement.service';
import { clampLimit } from '../../common/utils/pagination.util';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { SetChannelNotifyLevelDto } from './dto/set-channel-notify-level.dto';
import { CreatorHeartCommentDto, PinCommentDto } from './dto/comment-moderation.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Public } from '../../common/decorators/public.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/auth/permissions';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';

@ApiTags('Engagement')
@Controller()
export class EngagementController {
  constructor(private readonly engagementService: EngagementService) {}

  @Post('videos/:id/like')
  @Permissions(Permission.ENGAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Like a video (clears dislike)' })
  likeVideo(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) videoId: string) {
    return this.engagementService.likeVideo(user.sub, videoId);
  }

  @Delete('videos/:id/like')
  @Permissions(Permission.ENGAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove like from a video' })
  unlikeVideo(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) videoId: string) {
    return this.engagementService.unlikeVideo(user.sub, videoId);
  }

  @Post('videos/:id/dislike')
  @Permissions(Permission.ENGAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dislike a video (clears like)' })
  dislikeVideo(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) videoId: string) {
    return this.engagementService.dislikeVideo(user.sub, videoId);
  }

  @Delete('videos/:id/dislike')
  @Permissions(Permission.ENGAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove dislike from a video' })
  undislikeVideo(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) videoId: string) {
    return this.engagementService.undislikeVideo(user.sub, videoId);
  }

  @Post('videos/:id/comments')
  @Permissions(Permission.ENGAGE)
  @ApiOperation({ summary: 'Add a comment to a video' })
  createComment(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) videoId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.engagementService.createComment(user.sub, videoId, dto);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('videos/:id/comments')
  @ApiOperation({ summary: 'Get comments for a video' })
  getComments(
    @Param('id', ParseUUIDPipe) videoId: string,
    @Query('limit') limit: number,
    @Query('cursor') cursor: string,
    @Query('sort') sort: 'newest' | 'top' | 'oldest' = 'newest',
    @CurrentUser() user?: JwtPayload,
  ) {
    const normalized =
      sort === 'top' ? 'top' : sort === 'oldest' ? 'oldest' : 'newest';
    return this.engagementService.getComments(
      videoId,
      clampLimit(limit),
      cursor,
      user?.sub,
      normalized,
    );
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('videos/:videoId/comments/:commentId')
  @ApiOperation({ summary: 'Get a single comment (deep link / share)' })
  getComment(
    @Param('videoId', ParseUUIDPipe) videoId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.engagementService.getComment(videoId, commentId, user?.sub);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('videos/:videoId/comments/:commentId/replies')
  @ApiOperation({ summary: 'Get replies for a comment' })
  getCommentReplies(
    @Param('videoId', ParseUUIDPipe) videoId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Query('limit') limit: number,
    @Query('cursor') cursor: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.engagementService.getCommentReplies(
      videoId,
      commentId,
      clampLimit(limit),
      cursor,
      user?.sub,
    );
  }

  @Patch('videos/:videoId/comments/:commentId')
  @Permissions(Permission.ENGAGE)
  @ApiOperation({ summary: 'Edit a comment' })
  updateComment(
    @CurrentUser() user: JwtPayload,
    @Param('videoId', ParseUUIDPipe) videoId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.engagementService.updateComment(
      user.sub,
      user.role,
      videoId,
      commentId,
      dto,
    );
  }

  @Delete('videos/:videoId/comments/:commentId')
  @Permissions(Permission.ENGAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a comment' })
  deleteComment(
    @CurrentUser() user: JwtPayload,
    @Param('videoId', ParseUUIDPipe) videoId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    return this.engagementService.deleteComment(user.sub, user.role, videoId, commentId);
  }

  @Post('videos/:videoId/comments/:commentId/like')
  @Permissions(Permission.ENGAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Like a comment' })
  likeComment(
    @CurrentUser() user: JwtPayload,
    @Param('videoId', ParseUUIDPipe) videoId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    return this.engagementService.likeComment(user.sub, videoId, commentId);
  }

  @Delete('videos/:videoId/comments/:commentId/like')
  @Permissions(Permission.ENGAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlike a comment' })
  unlikeComment(
    @CurrentUser() user: JwtPayload,
    @Param('videoId', ParseUUIDPipe) videoId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    return this.engagementService.unlikeComment(user.sub, videoId, commentId);
  }

  @Post('videos/:videoId/comments/:commentId/pin')
  @Permissions(Permission.ENGAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pin or unpin a top-level comment (video owner)' })
  pinComment(
    @CurrentUser() user: JwtPayload,
    @Param('videoId', ParseUUIDPipe) videoId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() body: PinCommentDto,
  ) {
    return this.engagementService.setCommentPinned(
      user.sub,
      videoId,
      commentId,
      body.isPinned,
    );
  }

  @Post('videos/:videoId/comments/:commentId/creator-heart')
  @Permissions(Permission.ENGAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Heart a comment as the video owner' })
  creatorHeartComment(
    @CurrentUser() user: JwtPayload,
    @Param('videoId', ParseUUIDPipe) videoId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() body: CreatorHeartCommentDto,
  ) {
    return this.engagementService.setCommentCreatorHeart(
      user.sub,
      videoId,
      commentId,
      body.creatorHearted,
    );
  }

  @Post('follow/:userId')
  @Permissions(Permission.ENGAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Follow a user (legacy; prefer channels/:id/subscribe)' })
  follow(@CurrentUser() user: JwtPayload, @Param('userId', ParseUUIDPipe) targetId: string) {
    return this.engagementService.follow(user.sub, targetId);
  }

  @Delete('follow/:userId')
  @Permissions(Permission.ENGAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unfollow a user (legacy; prefer channels/:id/subscribe)' })
  unfollow(@CurrentUser() user: JwtPayload, @Param('userId', ParseUUIDPipe) targetId: string) {
    return this.engagementService.unfollow(user.sub, targetId);
  }

  @Post('channels/:userId/subscribe')
  @Permissions(Permission.ENGAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Subscribe to a channel' })
  subscribe(@CurrentUser() user: JwtPayload, @Param('userId', ParseUUIDPipe) channelId: string) {
    return this.engagementService.subscribe(user.sub, channelId);
  }

  @Delete('channels/:userId/subscribe')
  @Permissions(Permission.ENGAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unsubscribe from a channel' })
  unsubscribe(@CurrentUser() user: JwtPayload, @Param('userId', ParseUUIDPipe) channelId: string) {
    return this.engagementService.unsubscribe(user.sub, channelId);
  }

  @Get('channels/:userId/subscription')
  @Permissions(Permission.ENGAGE)
  @ApiOperation({ summary: 'Get subscription + notification bell level for a channel' })
  getSubscription(@CurrentUser() user: JwtPayload, @Param('userId', ParseUUIDPipe) channelId: string) {
    return this.engagementService.getSubscription(user.sub, channelId);
  }

  @Patch('channels/:userId/subscription/notify')
  @Permissions(Permission.ENGAGE)
  @ApiOperation({ summary: 'Set notification level for a channel subscription (all | personalized | none)' })
  setNotifyLevel(
    @CurrentUser() user: JwtPayload,
    @Param('userId', ParseUUIDPipe) channelId: string,
    @Body() dto: SetChannelNotifyLevelDto,
  ) {
    return this.engagementService.setNotifyLevel(user.sub, channelId, dto.notifyLevel);
  }

  @Get('me/disliked-videos')
  @Permissions(Permission.USE_LIBRARY)
  @ApiOperation({ summary: 'List videos the current user disliked (Library shelf)' })
  listDislikedVideos(@CurrentUser() user: JwtPayload, @Query('limit') limit?: number) {
    return this.engagementService.listDislikedVideos(user.sub, clampLimit(limit, 50, 200));
  }

  @Delete('me/disliked-videos')
  @Permissions(Permission.USE_LIBRARY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear Disliked videos shelf (remove dislike reactions)' })
  clearDislikedVideos(@CurrentUser() user: JwtPayload) {
    return this.engagementService.clearDislikedVideos(user.sub);
  }

  @Get('me/muted-channels')
  @Permissions(Permission.ENGAGE)
  @ApiOperation({ summary: 'List channels muted via Don’t recommend channel' })
  listMutedChannels(@CurrentUser() user: JwtPayload) {
    return this.engagementService.listMutedChannels(user.sub);
  }

  @Delete('channels/:userId/dont-recommend')
  @Permissions(Permission.ENGAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unmute a channel (resume recommending in feeds)' })
  unmuteChannel(@CurrentUser() user: JwtPayload, @Param('userId', ParseUUIDPipe) channelId: string) {
    return this.engagementService.unmuteChannelRecommendations(user.sub, channelId);
  }

  @Public()
  @Get('channels/:userId/subscribers')
  @ApiOperation({ summary: 'List channel subscribers' })
  listSubscribers(
    @Param('userId', ParseUUIDPipe) channelId: string,
    @Query('limit') limit: number,
    @Query('cursor') cursor: string,
  ) {
    return this.engagementService.getFollowers(channelId, clampLimit(limit), cursor);
  }

  @Public()
  @Get('channels/:userId/subscriptions')
  @ApiOperation({ summary: 'List channels this channel is subscribed to' })
  listSubscriptions(
    @Param('userId', ParseUUIDPipe) channelId: string,
    @Query('limit') limit: number,
    @Query('cursor') cursor: string,
  ) {
    return this.engagementService.getFollowing(channelId, clampLimit(limit), cursor);
  }
}
