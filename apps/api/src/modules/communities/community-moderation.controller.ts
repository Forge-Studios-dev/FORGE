import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommunityModerationService } from './community-moderation.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CommunityRoleType } from './entities/community-role.entity';
import { CommunityRoleGuard } from './guards/community-role.guard';
import { CommunityRoles } from './decorators/community-roles.decorator';

@ApiTags('Community Moderation')
@Controller()
export class CommunityModerationController {
  constructor(private readonly moderationService: CommunityModerationService) {}

  @Post('communities/:communityId/reports')
  @ApiOperation({ summary: 'Report a community message' })
  report(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Body() body: { channelId: string; messageId: string; reason: string },
  ) {
    return this.moderationService.reportMessage(user.sub, { communityId, ...body });
  }

  @Get('admin/community-reports')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List open community reports (admin)' })
  listReports(@Query('status') status = 'open') {
    return this.moderationService.listReports(status);
  }

  @Patch('admin/community-reports/:reportId/resolve')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Resolve a community report (admin)' })
  resolve(@CurrentUser() user: JwtPayload, @Param('reportId') reportId: string) {
    return this.moderationService.resolveReport(reportId, user.sub);
  }

  @Post('creators/me/communities/:communityId/bans')
  @UseGuards(CreatorApprovedGuard, CommunityRoleGuard)
  @CommunityRoles(CommunityRoleType.ADMIN, CommunityRoleType.MODERATOR, CommunityRoleType.OWNER)
  @ApiOperation({ summary: 'Ban a member from community' })
  ban(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Body() body: { userId: string; reason?: string },
  ) {
    return this.moderationService.banMember(user.sub, communityId, body.userId, body.reason);
  }

  @Post('creators/me/communities/:communityId/bans/:userId/remove')
  @UseGuards(CreatorApprovedGuard, CommunityRoleGuard)
  @CommunityRoles(CommunityRoleType.ADMIN, CommunityRoleType.MODERATOR, CommunityRoleType.OWNER)
  @ApiOperation({ summary: 'Unban a community member' })
  unban(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('userId') userId: string,
  ) {
    return this.moderationService.unbanMember(user.sub, communityId, userId);
  }

  @Post('creators/me/communities/:communityId/roles')
  @UseGuards(CreatorApprovedGuard, CommunityRoleGuard)
  @CommunityRoles(CommunityRoleType.ADMIN, CommunityRoleType.OWNER)
  @ApiOperation({ summary: 'Assign a community role to a user' })
  assignRole(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Body() body: { userId: string; role: CommunityRoleType },
  ) {
    return this.moderationService.assignRole(user.sub, communityId, body.userId, body.role);
  }

  @Get('creators/me/communities/:communityId/roles')
  @UseGuards(CreatorApprovedGuard, CommunityRoleGuard)
  @CommunityRoles(CommunityRoleType.ADMIN, CommunityRoleType.OWNER)
  @ApiOperation({ summary: 'List community role assignments' })
  listRoles(@CurrentUser() user: JwtPayload, @Param('communityId') communityId: string) {
    return this.moderationService.listRoles(user.sub, communityId);
  }

  @Delete('creators/me/communities/:communityId/roles/:userId')
  @UseGuards(CreatorApprovedGuard, CommunityRoleGuard)
  @CommunityRoles(CommunityRoleType.ADMIN, CommunityRoleType.OWNER)
  @ApiOperation({ summary: 'Remove a community role from a user' })
  removeRole(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('userId') userId: string,
  ) {
    return this.moderationService.removeRole(user.sub, communityId, userId);
  }

  @Get('creators/me/communities/:communityId/bans')
  @UseGuards(CreatorApprovedGuard, CommunityRoleGuard)
  @CommunityRoles(CommunityRoleType.ADMIN, CommunityRoleType.MODERATOR, CommunityRoleType.OWNER)
  @ApiOperation({ summary: 'List community bans' })
  listBans(@CurrentUser() user: JwtPayload, @Param('communityId') communityId: string) {
    return this.moderationService.listBans(user.sub, communityId);
  }

  @Get('creators/me/communities/:communityId/reports')
  @UseGuards(CreatorApprovedGuard, CommunityRoleGuard)
  @CommunityRoles(CommunityRoleType.ADMIN, CommunityRoleType.MODERATOR, CommunityRoleType.OWNER)
  @ApiOperation({ summary: 'List community reports for creator moderation' })
  listCommunityReports(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Query('status') status = 'open',
  ) {
    return this.moderationService.listReportsForCommunity(user.sub, communityId, status);
  }
}
