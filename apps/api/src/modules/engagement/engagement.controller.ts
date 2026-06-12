import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
  @ApiOperation({ summary: 'Like a video' })
  likeVideo(@CurrentUser() user: JwtPayload, @Param('id') videoId: string) {
    return this.engagementService.likeVideo(user.sub, videoId);
  }

  @Delete('videos/:id/like')
  @Permissions(Permission.ENGAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlike a video' })
  unlikeVideo(@CurrentUser() user: JwtPayload, @Param('id') videoId: string) {
    return this.engagementService.unlikeVideo(user.sub, videoId);
  }

  @Post('videos/:id/comments')
  @Permissions(Permission.ENGAGE)
  @ApiOperation({ summary: 'Add a comment to a video' })
  createComment(
    @CurrentUser() user: JwtPayload,
    @Param('id') videoId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.engagementService.createComment(user.sub, videoId, dto);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('videos/:id/comments')
  @ApiOperation({ summary: 'Get comments for a video' })
  getComments(
    @Param('id') videoId: string,
    @Query('limit') limit: number,
    @Query('cursor') cursor: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.engagementService.getComments(
      videoId,
      clampLimit(limit),
      cursor,
      user?.sub,
    );
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('videos/:videoId/comments/:commentId/replies')
  @ApiOperation({ summary: 'Get replies for a comment' })
  getCommentReplies(
    @Param('videoId') videoId: string,
    @Param('commentId') commentId: string,
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
    @Param('videoId') videoId: string,
    @Param('commentId') commentId: string,
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
    @Param('videoId') videoId: string,
    @Param('commentId') commentId: string,
  ) {
    return this.engagementService.deleteComment(user.sub, user.role, videoId, commentId);
  }

  @Post('videos/:videoId/comments/:commentId/like')
  @Permissions(Permission.ENGAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Like a comment' })
  likeComment(
    @CurrentUser() user: JwtPayload,
    @Param('videoId') videoId: string,
    @Param('commentId') commentId: string,
  ) {
    return this.engagementService.likeComment(user.sub, videoId, commentId);
  }

  @Delete('videos/:videoId/comments/:commentId/like')
  @Permissions(Permission.ENGAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlike a comment' })
  unlikeComment(
    @CurrentUser() user: JwtPayload,
    @Param('videoId') videoId: string,
    @Param('commentId') commentId: string,
  ) {
    return this.engagementService.unlikeComment(user.sub, videoId, commentId);
  }

  @Post('follow/:userId')
  @Permissions(Permission.ENGAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Follow a user' })
  follow(@CurrentUser() user: JwtPayload, @Param('userId') targetId: string) {
    return this.engagementService.follow(user.sub, targetId);
  }

  @Delete('follow/:userId')
  @Permissions(Permission.ENGAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unfollow a user' })
  unfollow(@CurrentUser() user: JwtPayload, @Param('userId') targetId: string) {
    return this.engagementService.unfollow(user.sub, targetId);
  }
}
