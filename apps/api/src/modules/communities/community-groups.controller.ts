import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommunityGroupsService } from './community-groups.service';
import { CommunityGroupType } from './entities/community-group.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('Community Groups')
@Controller()
export class CommunityGroupsController {
  constructor(private readonly groupsService: CommunityGroupsService) {}

  @Post('communities/:communityId/groups')
  @ApiOperation({ summary: 'Create a study or accountability group within a community' })
  create(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Body()
    body: {
      name: string;
      description?: string;
      groupType?: CommunityGroupType;
      maxMembers?: number;
      weeklyGoal?: string;
    },
  ) {
    return this.groupsService.createGroup(user.sub, communityId, body);
  }

  @Get('communities/:communityId/groups')
  @ApiOperation({ summary: 'List groups within a community (optionally filtered by type)' })
  list(
    @Param('communityId') communityId: string,
    @Query('type') type?: CommunityGroupType,
  ) {
    return this.groupsService.listGroups(communityId, type);
  }

  @Get('groups/:groupId')
  @ApiOperation({ summary: 'Get a group by ID' })
  get(@Param('groupId') groupId: string) {
    return this.groupsService.getGroup(groupId);
  }

  @Post('groups/:groupId/join')
  @ApiOperation({ summary: 'Join a study/accountability group' })
  join(@CurrentUser() user: JwtPayload, @Param('groupId') groupId: string) {
    return this.groupsService.joinGroup(user.sub, groupId);
  }

  @Delete('groups/:groupId/leave')
  @ApiOperation({ summary: 'Leave a group' })
  leave(@CurrentUser() user: JwtPayload, @Param('groupId') groupId: string) {
    return this.groupsService.leaveGroup(user.sub, groupId);
  }

  @Get('groups/:groupId/members')
  @ApiOperation({ summary: 'List group members' })
  members(@Param('groupId') groupId: string) {
    return this.groupsService.listMembers(groupId);
  }

  @Delete('groups/:groupId')
  @ApiOperation({ summary: 'Delete a group (creator only)' })
  delete(@CurrentUser() user: JwtPayload, @Param('groupId') groupId: string) {
    return this.groupsService.deleteGroup(user.sub, groupId);
  }
}
