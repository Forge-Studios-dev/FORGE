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
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommunitiesService } from './communities.service';
import {
  CreateCategoryDto,
  CreateChannelDto,
  CreateCommunityDto,
  InviteChannelMemberDto,
  ReorderChannelsDto,
  SendChannelMessageDto,
  TransferOwnershipDto,
  UpdateCategoryDto,
  UpdateChannelDto,
  UpdateCommunityDto,
} from './dto/community.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { SkillEconomyLmsGuard } from '../../common/guards/skill-economy-lms.guard';
import { DeprecatedChannelApi } from '../../common/decorators/deprecated-channel-api.decorator';
import { DeprecatedChannelApiInterceptor } from '../../common/interceptors/deprecated-channel-api.interceptor';
import { CommunityType } from './entities/community.entity';

/** Coerce an untrusted query value into a CommunityType, ignoring invalid input. */
function parseCommunityType(value?: string): CommunityType | undefined {
  return value && (Object.values(CommunityType) as string[]).includes(value)
    ? (value as CommunityType)
    : undefined;
}

@ApiTags('Communities')
@Controller()
@UseInterceptors(DeprecatedChannelApiInterceptor)
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('creators/:creatorId/communities')
  @ApiOperation({ summary: 'List creator communities' })
  listCommunities(@Param('creatorId', ParseUUIDPipe) creatorId: string, @CurrentUser() user?: JwtPayload) {
    return this.communitiesService.listCommunitiesForCreator(creatorId, user?.sub, user?.role);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('creators/:creatorId/communities/:slug/access')
  @ApiOperation({ summary: 'Community access metadata for join-request UX' })
  getCommunityAccessMeta(
    @Param('creatorId', ParseUUIDPipe) creatorId: string,
    @Param('slug') slug: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.communitiesService.getCommunityAccessMeta(
      creatorId,
      slug,
      user?.sub,
      user?.role,
    );
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('creators/:creatorId/communities/:slug')
  @ApiOperation({ summary: 'Get community by creator and slug' })
  getCommunityBySlug(
    @Param('creatorId', ParseUUIDPipe) creatorId: string,
    @Param('slug') slug: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.communitiesService.getCommunityBySlug(creatorId, slug, user?.sub, user?.role);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('communities/:communityId/layout')
  @ApiOperation({ summary: 'Unified community layout (categories, channels, rooms)' })
  getCommunityLayout(@Param('communityId', ParseUUIDPipe) communityId: string, @CurrentUser() user?: JwtPayload) {
    return this.communitiesService.getCommunityLayout(communityId, user?.sub, user?.role);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('communities/id/:communityId')
  @ApiOperation({ summary: 'Get community by ID' })
  getCommunityById(@Param('communityId', ParseUUIDPipe) communityId: string, @CurrentUser() user?: JwtPayload) {
    return this.communitiesService.getCommunityById(communityId, user?.sub, user?.role);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('communities/search')
  @ApiOperation({ summary: 'Discover public communities by name or slug (optional type filter)' })
  searchCommunities(
    @Query('q') q = '',
    @Query('limit') limit = 20,
    @Query('type') type?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.communitiesService.searchCommunities(
      q,
      Number(limit) || 20,
      parseCommunityType(type),
      user?.sub,
    );
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('communities/discover/featured')
  @ApiOperation({ summary: 'Featured public communities for discovery browse (optional type filter)' })
  featuredCommunities(
    @Query('limit') limit = 12,
    @Query('type') type?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.communitiesService.listFeaturedCommunities(
      Number(limit) || 12,
      parseCommunityType(type),
      user?.sub,
    );
  }

  /** @deprecated Use GET /creators/:creatorId/communities/:slug — returns default community */
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('communities/:creatorId')
  @ApiOperation({ summary: 'Get creator default community (legacy)' })
  getCommunity(@Param('creatorId', ParseUUIDPipe) creatorId: string, @CurrentUser() user?: JwtPayload) {
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
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Body() dto: UpdateCommunityDto,
  ) {
    return this.communitiesService.updateCommunity(user.sub, communityId, dto);
  }

  @Post('creators/me/communities/:communityId/transfer-ownership')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Transfer community ownership to another active member' })
  transferOwnership(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Body() dto: TransferOwnershipDto,
  ) {
    return this.communitiesService.transferCommunityOwnership(communityId, user.sub, dto.newOwnerId);
  }

  @Get('creators/me/communities/:communityId/categories')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'List community categories' })
  listCategories(@CurrentUser() user: JwtPayload, @Param('communityId', ParseUUIDPipe) communityId: string) {
    return this.communitiesService.listCategories(user.sub, communityId);
  }

  @Post('creators/me/communities/:communityId/categories')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Create a category' })
  createCategory(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.communitiesService.createCategory(user.sub, communityId, dto);
  }

  @Patch('creators/me/communities/:communityId/categories/:categoryId')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Update a category' })
  updateCategory(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.communitiesService.updateCategory(user.sub, communityId, categoryId, dto);
  }

  @Delete('creators/me/communities/:communityId/categories/:categoryId')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Delete a category' })
  deleteCategory(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.communitiesService.deleteCategory(user.sub, communityId, categoryId);
  }

  @Post('creators/me/communities/:communityId/channels')
  @UseGuards(CreatorApprovedGuard)
  @DeprecatedChannelApi()
  @ApiOperation({ summary: 'Create a channel in a community (deprecated — use rooms)' })
  createChannelInCommunity(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Body() dto: CreateChannelDto,
  ) {
    return this.communitiesService.createChannel(user.sub, dto, communityId);
  }

  /** @deprecated Prefer POST /creators/me/communities/:communityId/rooms */
  @Post('creators/me/channels')
  @UseGuards(CreatorApprovedGuard)
  @DeprecatedChannelApi()
  @ApiOperation({ summary: 'Create a community channel (legacy — use rooms)' })
  createChannel(@CurrentUser() user: JwtPayload, @Body() dto: CreateChannelDto) {
    return this.communitiesService.createChannel(user.sub, dto);
  }

  @Patch('creators/me/channels/:channelId')
  @UseGuards(CreatorApprovedGuard)
  @DeprecatedChannelApi()
  @ApiOperation({ summary: 'Update a community channel (deprecated — use rooms)' })
  updateChannel(
    @CurrentUser() user: JwtPayload,
    @Param('channelId', ParseUUIDPipe) channelId: string,
    @Body() dto: UpdateChannelDto,
  ) {
    return this.communitiesService.updateChannel(user.sub, channelId, dto);
  }

  @Delete('creators/me/channels/:channelId')
  @UseGuards(CreatorApprovedGuard)
  @DeprecatedChannelApi()
  @ApiOperation({ summary: 'Delete a community channel (deprecated — use rooms)' })
  deleteChannel(@CurrentUser() user: JwtPayload, @Param('channelId', ParseUUIDPipe) channelId: string) {
    return this.communitiesService.deleteChannel(user.sub, channelId);
  }

  @Patch('creators/me/communities/:communityId/channels/reorder')
  @UseGuards(CreatorApprovedGuard)
  @DeprecatedChannelApi()
  @ApiOperation({ summary: 'Reorder channels (deprecated — use rooms)' })
  reorderChannels(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Body() body: ReorderChannelsDto,
  ) {
    return this.communitiesService.reorderChannels(user.sub, communityId, body.channelIds ?? []);
  }

  @Post('creators/me/channels/:channelId/invite')
  @UseGuards(CreatorApprovedGuard)
  @DeprecatedChannelApi()
  @ApiOperation({ summary: 'Invite user to invite-only channel (deprecated)' })
  inviteMember(
    @CurrentUser() user: JwtPayload,
    @Param('channelId', ParseUUIDPipe) channelId: string,
    @Body() dto: InviteChannelMemberDto,
  ) {
    return this.communitiesService.inviteMember(user.sub, channelId, dto);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('channels/:channelId/messages')
  @DeprecatedChannelApi()
  @ApiOperation({ summary: 'Get channel messages (deprecated — bridged to room when mapped)' })
  getMessages(
    @Param('channelId', ParseUUIDPipe) channelId: string,
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
  @DeprecatedChannelApi()
  @ApiOperation({ summary: 'Send a channel message (deprecated — bridged to room when mapped)' })
  sendMessage(
    @Param('channelId', ParseUUIDPipe) channelId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SendChannelMessageDto,
  ) {
    return this.communitiesService.sendChannelMessage(channelId, user.sub, dto, user.role);
  }

  @Delete('channels/:channelId/messages/:messageId')
  @DeprecatedChannelApi()
  @ApiOperation({ summary: 'Soft-delete a channel message (deprecated — use room messages)' })
  deleteMessage(
    @Param('channelId', ParseUUIDPipe) channelId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
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
    @Param('communityId', ParseUUIDPipe) communityId: string,
  ) {
    return this.communitiesService.getCommunityAnalytics(user.sub, communityId);
  }

  @Get('creators/me/business-analytics')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Creator business OS funnel — membership to engagement (30d)' })
  businessAnalytics(@CurrentUser() user: JwtPayload) {
    return this.communitiesService.getCreatorBusinessAnalytics(user.sub);
  }

  @Get('creators/me/attention')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Studio home "today" strip — comments, moderation & billing needing action' })
  attention(@CurrentUser() user: JwtPayload) {
    return this.communitiesService.getCreatorAttention(user.sub);
  }

  @Get('creators/me/business-analytics/export')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Export creator business analytics as CSV' })
  async businessAnalyticsExport(@CurrentUser() user: JwtPayload, @Res() res: Response) {
    const csv = await this.communitiesService.getCreatorBusinessAnalyticsCsv(user.sub);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="business-analytics.csv"');
    res.send(csv);
  }

  @Get('creators/me/ecosystem-tree')
  @UseGuards(SkillEconomyLmsGuard, CreatorApprovedGuard)
  @ApiOperation({ summary: 'Unified creator ecosystem tree — brands, communities, courses, programs, bundles' })
  ecosystemTree(@CurrentUser() user: JwtPayload) {
    return this.communitiesService.getCreatorEcosystemTree(user.sub);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('communities/:communityId/permissions/matrix')
  @ApiOperation({ summary: 'Community role permission matrix + viewer effective permissions' })
  permissionMatrix(
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.communitiesService.getCommunityPermissionMatrix(
      communityId,
      user?.sub,
      user?.role,
    );
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('communities/:communityId/live')
  @ApiOperation({ summary: 'Live streams scoped to a community' })
  communityLive(
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.communitiesService.getCommunityLiveStreams(communityId, user?.sub, user?.role);
  }
}
