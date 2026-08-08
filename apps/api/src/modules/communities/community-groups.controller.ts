import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { CommunityGroupsService } from './community-groups.service';
import { CommunityGroupType } from './entities/community-group.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';

class CreateCommunityGroupDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: CommunityGroupType })
  @IsOptional()
  @IsEnum(CommunityGroupType)
  groupType?: CommunityGroupType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(2)
  maxMembers?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  weeklyGoal?: string;
}

@ApiTags('Community Groups')
@Controller()
export class CommunityGroupsController {
  constructor(private readonly groupsService: CommunityGroupsService) {}

  @Post('communities/:communityId/groups')
  @ApiOperation({ summary: 'Create a study or accountability group within a community' })
  create(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Body() body: CreateCommunityGroupDto,
  ) {
    return this.groupsService.createGroup(user.sub, communityId, body, user.role);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('communities/:communityId/groups')
  @ApiOperation({ summary: 'List groups within a community (optionally filtered by type)' })
  list(
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Query('type') type?: CommunityGroupType,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.groupsService.listGroups(communityId, type, user?.sub, user?.role);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('groups/:groupId')
  @ApiOperation({ summary: 'Get a group by ID' })
  get(@Param('groupId', ParseUUIDPipe) groupId: string, @CurrentUser() user?: JwtPayload) {
    return this.groupsService.getGroup(groupId, user?.sub, user?.role);
  }

  @Post('groups/:groupId/join')
  @ApiOperation({ summary: 'Join a study/accountability group' })
  join(@CurrentUser() user: JwtPayload, @Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.groupsService.joinGroup(user.sub, groupId, user.role);
  }

  @Delete('groups/:groupId/leave')
  @ApiOperation({ summary: 'Leave a group' })
  leave(@CurrentUser() user: JwtPayload, @Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.groupsService.leaveGroup(user.sub, groupId);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('groups/:groupId/members')
  @ApiOperation({ summary: 'List group members' })
  members(@Param('groupId', ParseUUIDPipe) groupId: string, @CurrentUser() user?: JwtPayload) {
    return this.groupsService.listMembers(groupId, user?.sub, user?.role);
  }

  @Delete('groups/:groupId')
  @ApiOperation({ summary: 'Delete a group (creator only)' })
  delete(@CurrentUser() user: JwtPayload, @Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.groupsService.deleteGroup(user.sub, groupId);
  }
}
