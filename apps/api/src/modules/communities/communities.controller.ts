import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommunitiesService } from './communities.service';
import {
  CreateChannelDto,
  UpdateChannelDto,
  SendChannelMessageDto,
  InviteChannelMemberDto,
} from './dto/community.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';

@ApiTags('Communities')
@Controller()
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('communities/:creatorId')
  @ApiOperation({ summary: 'Get creator community and visible channels' })
  getCommunity(@Param('creatorId') creatorId: string, @CurrentUser() user?: JwtPayload) {
    return this.communitiesService.getCommunityByCreator(creatorId, user?.sub, user?.role);
  }

  @Post('creators/me/channels')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Create a community channel' })
  createChannel(@CurrentUser() user: JwtPayload, @Body() dto: CreateChannelDto) {
    return this.communitiesService.createChannel(user.sub, dto);
  }

  @Patch('creators/me/channels/:channelId')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Update a community channel' })
  updateChannel(
    @CurrentUser() user: JwtPayload,
    @Param('channelId') channelId: string,
    @Body() dto: UpdateChannelDto,
  ) {
    return this.communitiesService.updateChannel(user.sub, channelId, dto);
  }

  @Post('creators/me/channels/:channelId/invite')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Invite user to invite-only channel' })
  inviteMember(
    @CurrentUser() user: JwtPayload,
    @Param('channelId') channelId: string,
    @Body() dto: InviteChannelMemberDto,
  ) {
    return this.communitiesService.inviteMember(user.sub, channelId, dto);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('channels/:channelId/messages')
  @ApiOperation({ summary: 'Get channel messages' })
  getMessages(
    @Param('channelId') channelId: string,
    @CurrentUser() user: JwtPayload | undefined,
    @Query('limit') limit = 50,
    @Query('cursor') cursor?: string,
  ) {
    return this.communitiesService.getChannelMessages(
      channelId,
      user?.sub,
      user?.role,
      Number(limit) || 50,
      cursor,
    );
  }

  @Post('channels/:channelId/messages')
  @ApiOperation({ summary: 'Send a channel message' })
  sendMessage(
    @Param('channelId') channelId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SendChannelMessageDto,
  ) {
    return this.communitiesService.sendChannelMessage(channelId, user.sub, dto, user.role);
  }

  @Delete('channels/:channelId/messages/:messageId')
  @ApiOperation({ summary: 'Soft-delete a channel message' })
  deleteMessage(
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.communitiesService.deleteChannelMessage(
      channelId,
      messageId,
      user.sub,
      user.role,
    );
  }
}
