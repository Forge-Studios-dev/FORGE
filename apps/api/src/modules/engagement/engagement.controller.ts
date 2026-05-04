import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EngagementService } from './engagement.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Engagement')
@Controller()
export class EngagementController {
  constructor(private readonly engagementService: EngagementService) {}

  @Post('videos/:id/like')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Like a video' })
  likeVideo(@CurrentUser() user: JwtPayload, @Param('id') videoId: string) {
    return this.engagementService.likeVideo(user.sub, videoId);
  }

  @Delete('videos/:id/like')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlike a video' })
  unlikeVideo(@CurrentUser() user: JwtPayload, @Param('id') videoId: string) {
    return this.engagementService.unlikeVideo(user.sub, videoId);
  }

  @Post('videos/:id/comments')
  @ApiOperation({ summary: 'Add a comment to a video' })
  createComment(
    @CurrentUser() user: JwtPayload,
    @Param('id') videoId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.engagementService.createComment(user.sub, videoId, dto);
  }

  @Public()
  @Get('videos/:id/comments')
  @ApiOperation({ summary: 'Get comments for a video' })
  getComments(
    @Param('id') videoId: string,
    @Query('limit') limit: number,
    @Query('cursor') cursor: string,
  ) {
    return this.engagementService.getComments(videoId, limit || 20, cursor);
  }

  @Post('follow/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Follow a user' })
  follow(@CurrentUser() user: JwtPayload, @Param('userId') targetId: string) {
    return this.engagementService.follow(user.sub, targetId);
  }

  @Delete('follow/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unfollow a user' })
  unfollow(@CurrentUser() user: JwtPayload, @Param('userId') targetId: string) {
    return this.engagementService.unfollow(user.sub, targetId);
  }
}
