import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { StudyGroupsService } from './study-groups.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { StudyGroupCheckInStatus, StudyGroupType } from './entities/study-group.entity';

class CreateStudyGroupDto {
  @ApiProperty({ enum: StudyGroupType })
  @IsEnum(StudyGroupType)
  groupType: StudyGroupType;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  topic?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(2)
  maxMembers?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}

class UpdateStudyGroupDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  topic?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(2)
  maxMembers?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}

class SubmitCheckInDto {
  @ApiPropertyOptional({ enum: StudyGroupCheckInStatus })
  @IsOptional()
  @IsEnum(StudyGroupCheckInStatus)
  status?: StudyGroupCheckInStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

@ApiTags('Study Groups')
@Controller('study-groups')
export class StudyGroupsController {
  constructor(private readonly studyGroupsService: StudyGroupsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a study or accountability group' })
  create(@CurrentUser() user: JwtPayload, @Body() body: CreateStudyGroupDto) {
    return this.studyGroupsService.createGroup(user.sub, body);
  }

  @Patch(':groupId')
  @ApiOperation({ summary: 'Update a group (owner only)' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() body: UpdateStudyGroupDto,
  ) {
    return this.studyGroupsService.updateGroup(user.sub, groupId, body);
  }

  @Delete(':groupId')
  @ApiOperation({ summary: 'Delete a group (owner only)' })
  remove(@CurrentUser() user: JwtPayload, @Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.studyGroupsService.deleteGroup(user.sub, groupId);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Browse public study/accountability groups' })
  listPublic(
    @Query('groupType') groupType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.studyGroupsService.listPublicGroups({
      groupType:
        groupType === StudyGroupType.STUDY || groupType === StudyGroupType.ACCOUNTABILITY
          ? groupType
          : undefined,
      page,
      limit,
    });
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':groupId')
  @ApiOperation({ summary: 'Get a group (includes your membership status if signed in)' })
  getGroup(@Param('groupId', ParseUUIDPipe) groupId: string, @CurrentUser() user?: JwtPayload) {
    return this.studyGroupsService.getGroup(groupId, user?.sub);
  }

  @Post(':groupId/join')
  @ApiOperation({ summary: 'Join a group (immediate if public, pending approval if private)' })
  join(@CurrentUser() user: JwtPayload, @Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.studyGroupsService.joinGroup(user.sub, groupId);
  }

  @Post(':groupId/leave')
  @ApiOperation({ summary: 'Leave a group' })
  leave(@CurrentUser() user: JwtPayload, @Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.studyGroupsService.leaveGroup(user.sub, groupId);
  }

  @Post(':groupId/members/:userId/approve')
  @ApiOperation({ summary: 'Approve a pending join request (owner only)' })
  approveMember(
    @CurrentUser() user: JwtPayload,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.studyGroupsService.approveMember(user.sub, groupId, userId);
  }

  @Delete(':groupId/members/:userId')
  @ApiOperation({ summary: 'Remove a member (owner only)' })
  removeMember(
    @CurrentUser() user: JwtPayload,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.studyGroupsService.removeMember(user.sub, groupId, userId);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':groupId/members')
  @ApiOperation({ summary: 'List active members (members-only if the group is private)' })
  listMembers(@Param('groupId', ParseUUIDPipe) groupId: string, @CurrentUser() user?: JwtPayload) {
    return this.studyGroupsService.listMembers(groupId, user?.sub);
  }

  @Post(':groupId/check-ins')
  @ApiOperation({ summary: 'Submit a check-in (active members only)' })
  submitCheckIn(
    @CurrentUser() user: JwtPayload,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() body: SubmitCheckInDto,
  ) {
    return this.studyGroupsService.submitCheckIn(user.sub, groupId, body);
  }

  @Get(':groupId/check-ins')
  @ApiOperation({ summary: 'List check-ins (active members only)' })
  listCheckIns(
    @CurrentUser() user: JwtPayload,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.studyGroupsService.listCheckIns(groupId, user.sub, { page, limit });
  }
}
