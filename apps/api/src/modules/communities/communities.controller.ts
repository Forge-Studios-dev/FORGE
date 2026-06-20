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
  CreateCategoryDto,
  CreateChannelDto,
  CreateCommunityDto,
  InviteChannelMemberDto,
  SendChannelMessageDto,
  UpdateCategoryDto,
  UpdateChannelDto,
  UpdateCommunityDto,
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
  @Get('creators/:creatorId/communities')
  @ApiOperation({ summary: 'List creator communities' })
  listCommunities(@Param('creatorId') creatorId: string, @CurrentUser() user?: JwtPayload) {
    return this.communitiesService.listCommunitiesForCreator(creatorId, user?.sub, user?.role);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('creators/:creatorId/communities/:slug')
  @ApiOperation({ summary: 'Get community by creator and slug' })
  getCommunityBySlug(
    @Param('creatorId') creatorId: string,
    @Param('slug') slug: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.communitiesService.getCommunityBySlug(creatorId, slug, user?.sub, user?.role);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('communities/id/:communityId')
  @ApiOperation({ summary: 'Get community by ID' })
  getCommunityById(@Param('communityId') communityId: string, @CurrentUser() user?: JwtPayload) {
    return this.communitiesService.getCommunityById(communityId, user?.sub, user?.role);
  }

  @Public()
  @Get('communities/search')
  @ApiOperation({ summary: 'Discover public communities by name or slug' })
  searchCommunities(@Query('q') q = '', @Query('limit') limit = 20) {
    return this.communitiesService.searchCommunities(q, Number(limit) || 20);
  }

  /** @deprecated Use GET /creators/:creatorId/communities/:slug — returns default community */
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('communities/:creatorId')
  @ApiOperation({ summary: 'Get creator default community (legacy)' })
  getCommunity(@Param('creatorId') creatorId: string, @CurrentUser() user?: JwtPayload) {
    return this.communitiesService.getCommunityByCreator(creatorId, user?.sub, user?.role);
  }

  @Post('creators/me/communities')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Create a community' })
  createCommunity(@CurrentUser() user: JwtPayload, @Body() dto: CreateCommunityDto) {
    return this.communitiesService.createCommunity(user.sub, dto);
  }

  @Patch('creators/me/communities/:communityId')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Update community settings' })
  updateCommunity(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Body() dto: UpdateCommunityDto,
  ) {
    return this.communitiesService.updateCommunity(user.sub, communityId, dto);
  }

  @Get('creators/me/communities/:communityId/categories')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'List community categories' })
  listCategories(@CurrentUser() user: JwtPayload, @Param('communityId') communityId: string) {
    return this.communitiesService.listCategories(user.sub, communityId);
  }

  @Post('creators/me/communities/:communityId/categories')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Create a category' })
  createCategory(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.communitiesService.createCategory(user.sub, communityId, dto);
  }

  @Patch('creators/me/communities/:communityId/categories/:categoryId')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Update a category' })
  updateCategory(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.communitiesService.updateCategory(user.sub, communityId, categoryId, dto);
  }

  @Delete('creators/me/communities/:communityId/categories/:categoryId')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Delete a category' })
  deleteCategory(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.communitiesService.deleteCategory(user.sub, communityId, categoryId);
  }

  @Post('creators/me/communities/:communityId/channels')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Create a channel in a community' })
  createChannelInCommunity(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Body() dto: CreateChannelDto,
  ) {
    return this.communitiesService.createChannel(user.sub, dto, communityId);
  }

  /** @deprecated Prefer POST /creators/me/communities/:communityId/channels */
  @Post('creators/me/channels')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Create a community channel (legacy — default community)' })
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
    @Query('parentId') parentId?: string,
  ) {
    return this.communitiesService.getChannelMessages(
      channelId,
      user?.sub,
      user?.role,
      Number(limit) || 50,
      cursor,
      parentId,
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
  @ApiOperation({ summary: 'Soft-delete a channel message (author, creator, or mod)' })
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

  @Get('creators/me/moderated-communities')
  @ApiOperation({ summary: 'List communities where the user has a delegated moderation role' })
  listModeratedCommunities(@CurrentUser() user: JwtPayload) {
    return this.communitiesService.listModeratedCommunities(user.sub);
  }

  @Get('creators/me/communities/:communityId/analytics')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Community engagement analytics (creator)' })
  communityAnalytics(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
  ) {
    return this.communitiesService.getCommunityAnalytics(user.sub, communityId);
  }

  @Get('creators/me/business-analytics')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Creator business OS funnel — membership to engagement (30d)' })
  businessAnalytics(@CurrentUser() user: JwtPayload) {
    return this.communitiesService.getCreatorBusinessAnalytics(user.sub);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('communities/:communityId/live')
  @ApiOperation({ summary: 'Live streams scoped to a community' })
  communityLive(
    @Param('communityId') communityId: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.communitiesService.getCommunityLiveStreams(communityId, user?.sub, user?.role);
  }
}
