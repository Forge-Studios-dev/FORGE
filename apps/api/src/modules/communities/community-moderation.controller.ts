import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CommunityModerationService } from './community-moderation.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CommunityRoleType } from './entities/community-role.entity';
import { CommunityRoleGuard } from './guards/community-role.guard';
import { CommunityRoles } from './decorators/community-roles.decorator';
import { AssignRoleDto, BanMemberDto, CreateReportDto } from './dto/community.dto';

@ApiTags('Community Moderation')
@Controller()
export class CommunityModerationController {
  constructor(private readonly moderationService: CommunityModerationService) {}

  @Post('communities/:communityId/reports')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Report community content (message, post, poll, or user)' })
  report(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Body() body: CreateReportDto,
  ) {
    return this.moderationService.createReport(
      user.sub,
      { communityId, ...body },
      user.role,
    );
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
  resolve(@CurrentUser() user: JwtPayload, @Param('reportId', ParseUUIDPipe) reportId: string) {
    return this.moderationService.resolveReport(reportId, user.sub);
  }

  @Post('creators/me/communities/:communityId/bans')
  @UseGuards(CommunityRoleGuard)
  @CommunityRoles(CommunityRoleType.ADMIN, CommunityRoleType.MODERATOR, CommunityRoleType.OWNER)
  @ApiOperation({ summary: 'Ban a member from community' })
  ban(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Body() body: BanMemberDto,
  ) {
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;
    return this.moderationService.banMember(
      user.sub,
      communityId,
      body.userId,
      body.reason,
      expiresAt,
      user.role,
    );
  }

  @Post('creators/me/communities/:communityId/bans/:userId/remove')
  @UseGuards(CommunityRoleGuard)
  @CommunityRoles(CommunityRoleType.ADMIN, CommunityRoleType.MODERATOR, CommunityRoleType.OWNER)
  @ApiOperation({ summary: 'Unban a community member' })
  unban(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.moderationService.unbanMember(user.sub, communityId, userId, user.role);
  }

  @Post('creators/me/communities/:communityId/roles')
  @UseGuards(CommunityRoleGuard)
  @CommunityRoles(CommunityRoleType.ADMIN, CommunityRoleType.OWNER)
  @ApiOperation({ summary: 'Assign a community role to a user' })
  assignRole(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Body() body: AssignRoleDto,
  ) {
    return this.moderationService.assignRole(
      user.sub,
      communityId,
      body.userId,
      body.role,
      user.role,
    );
  }

  @Get('creators/me/communities/:communityId/roles')
  @UseGuards(CommunityRoleGuard)
  @CommunityRoles(CommunityRoleType.ADMIN, CommunityRoleType.OWNER)
  @ApiOperation({ summary: 'List community role assignments' })
  listRoles(@CurrentUser() user: JwtPayload, @Param('communityId', ParseUUIDPipe) communityId: string) {
    return this.moderationService.listRoles(user.sub, communityId, user.role);
  }

  @Delete('creators/me/communities/:communityId/roles/:userId')
  @UseGuards(CommunityRoleGuard)
  @CommunityRoles(CommunityRoleType.ADMIN, CommunityRoleType.OWNER)
  @ApiOperation({ summary: 'Remove a community role from a user' })
  removeRole(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.moderationService.removeRole(user.sub, communityId, userId, user.role);
  }

  @Get('creators/me/communities/:communityId/bans')
  @UseGuards(CommunityRoleGuard)
  @CommunityRoles(CommunityRoleType.ADMIN, CommunityRoleType.MODERATOR, CommunityRoleType.OWNER)
  @ApiOperation({ summary: 'List community bans' })
  listBans(@CurrentUser() user: JwtPayload, @Param('communityId', ParseUUIDPipe) communityId: string) {
    return this.moderationService.listBans(user.sub, communityId, user.role);
  }

  @Get('creators/me/moderation/inbox')
  @ApiOperation({ summary: 'Unified moderation inbox across all creator communities' })
  unifiedInbox(@CurrentUser() user: JwtPayload, @Query('status') status = 'open') {
    return this.moderationService.listUnifiedReportsForCreator(user.sub, status);
  }

  @Get('creators/me/communities/:communityId/reports')
  @UseGuards(CommunityRoleGuard)
  @CommunityRoles(
    CommunityRoleType.ADMIN,
    CommunityRoleType.MODERATOR,
    CommunityRoleType.OWNER,
    CommunityRoleType.COACH,
  )
  @ApiOperation({ summary: 'List community reports for creator moderation' })
  listCommunityReports(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Query('status') status = 'open',
  ) {
    return this.moderationService.listReportsForCommunity(
      user.sub,
      communityId,
      status,
      user.role,
    );
  }

  @Patch('creators/me/communities/:communityId/reports/:reportId/resolve')
  @UseGuards(CommunityRoleGuard)
  @CommunityRoles(
    CommunityRoleType.ADMIN,
    CommunityRoleType.MODERATOR,
    CommunityRoleType.OWNER,
    CommunityRoleType.COACH,
  )
  @ApiOperation({ summary: 'Resolve a community report (creator/moderator)' })
  resolveCommunityReport(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('reportId', ParseUUIDPipe) reportId: string,
  ) {
    return this.moderationService.resolveReportForCommunity(
      user.sub,
      communityId,
      reportId,
      user.role,
    );
  }
}
