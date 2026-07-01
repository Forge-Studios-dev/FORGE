import { Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CommunityMembersService } from './community-members.service';
import { CommunityMemberStatus } from './entities/community-member.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CommunityStudioGuard } from './guards/community-studio.guard';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';

@ApiTags('Community Members')
@Controller()
export class CommunityMembersController {
  constructor(private readonly membersService: CommunityMembersService) {}

  @Post('communities/:communityId/join-request')
  @ApiOperation({ summary: 'Request to join a private or invite community' })
  requestJoin(@CurrentUser() user: JwtPayload, @Param('communityId') communityId: string) {
    return this.membersService.requestJoin(user.sub, communityId, user.role);
  }

  @Get('creators/me/communities/:communityId/members')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'List community members and join requests' })
  listMembers(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Query('status') status?: CommunityMemberStatus,
  ) {
    return this.membersService.listMembers(user.sub, communityId, status);
  }

  @Patch('creators/me/communities/:communityId/members/:userId/approve')
  @UseGuards(CommunityStudioGuard)
  @ApiOperation({ summary: 'Approve a pending community member' })
  approve(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('userId') userId: string,
  ) {
    return this.membersService.approveMember(user.sub, communityId, userId, user.role);
  }

  @Patch('creators/me/communities/:communityId/members/:userId/reject')
  @UseGuards(CommunityStudioGuard)
  @ApiOperation({ summary: 'Reject a pending community member' })
  reject(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('userId') userId: string,
  ) {
    return this.membersService.rejectMember(user.sub, communityId, userId, user.role);
  }

  @Patch('creators/me/communities/:communityId/members/:userId/suspend')
  @UseGuards(CommunityStudioGuard)
  @ApiOperation({ summary: 'Suspend an active community member' })
  suspend(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('userId') userId: string,
  ) {
    return this.membersService.suspendMember(user.sub, communityId, userId, user.role);
  }

  @Patch('creators/me/communities/:communityId/members/:userId/unsuspend')
  @UseGuards(CommunityStudioGuard)
  @ApiOperation({ summary: 'Restore a suspended community member' })
  unsuspend(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('userId') userId: string,
  ) {
    return this.membersService.unsuspendMember(user.sub, communityId, userId, user.role);
  }

  @Get('creators/me/communities/:communityId/members/export')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Export community members as CSV' })
  async exportMembers(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Res() res: Response,
  ) {
    const csv = await this.membersService.exportMembersCsv(user.sub, communityId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="community-${communityId}-members.csv"`);
    res.send(csv);
  }
}
