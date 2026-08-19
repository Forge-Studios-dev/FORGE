import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommunityRoomsService } from './community-rooms.service';
import { CommunityRoomMessagesService } from './community-room-messages.service';
import { CommunityRoomPermissionsService } from './community-room-permissions.service';
import { CommunityRoomPermission } from './entities/community-room-message.entity';
import { CommunityRoomType } from './entities/community-room.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { CommunityStudioGuard } from './guards/community-studio.guard';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';

class CreateCommunityRoomDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ enum: CommunityRoomType })
  @IsOptional()
  @IsEnum(CommunityRoomType)
  roomType?: CommunityRoomType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(2)
  maxParticipants?: number;

  @ApiPropertyOptional({ description: 'Minimum tier required (VIP room)' })
  @IsOptional()
  @IsUUID()
  requiredTierId?: string;

  @ApiPropertyOptional({ description: 'Parent room for breakout sessions' })
  @IsOptional()
  @IsUUID()
  parentRoomId?: string;
}

class UpdateCommunityRoomDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(2)
  maxParticipants?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  requiredTierId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;
}

class SendCommunityRoomMessageDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentMessageId?: string;
}

class GrantCommunityRoomPermissionDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({ enum: CommunityRoomPermission })
  @IsOptional()
  @IsEnum(CommunityRoomPermission)
  permission?: CommunityRoomPermission;
}

class RevokeCommunityRoomPermissionDto {
  @ApiPropertyOptional({ enum: CommunityRoomPermission })
  @IsOptional()
  @IsEnum(CommunityRoomPermission)
  permission?: CommunityRoomPermission;
}

@ApiTags('Community Rooms')
@Controller()
export class CommunityRoomsController {
  constructor(
    private readonly roomsService: CommunityRoomsService,
    private readonly roomMessagesService: CommunityRoomMessagesService,
    private readonly roomPermissionsService: CommunityRoomPermissionsService,
  ) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('communities/:communityId/rooms')
  @ApiOperation({ summary: 'List active rooms in a community' })
  listRooms(@Param('communityId', ParseUUIDPipe) communityId: string, @CurrentUser() user?: JwtPayload) {
    return this.roomsService.listRooms(communityId, user?.sub, user?.role);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('communities/:communityId/rooms/:roomId')
  @ApiOperation({ summary: 'Get a community room by id' })
  getRoom(
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.roomsService.getRoom(communityId, roomId, user?.sub, user?.role);
  }

  @Post('creators/me/communities/:communityId/rooms')
  @UseGuards(CommunityStudioGuard)
  @ApiOperation({ summary: 'Create a community room (text, voice, stage, or breakout)' })
  createRoom(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Body() dto: CreateCommunityRoomDto,
  ) {
    return this.roomsService.createRoom(user.sub, communityId, dto, user.role);
  }

  @Patch('creators/me/communities/:communityId/rooms/:roomId')
  @UseGuards(CommunityStudioGuard)
  @ApiOperation({ summary: 'Update a community room' })
  updateRoom(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() body: UpdateCommunityRoomDto,
  ) {
    return this.roomsService.updateRoom(user.sub, communityId, roomId, body, user.role);
  }

  @Delete('creators/me/communities/:communityId/rooms/:roomId')
  @UseGuards(CommunityStudioGuard)
  @ApiOperation({ summary: 'Deactivate a community room' })
  deactivateRoom(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ) {
    return this.roomsService.deactivateRoom(user.sub, communityId, roomId, user.role);
  }

  @Post('communities/:communityId/rooms/:roomId/token')
  @ApiOperation({ summary: 'Get LiveKit token to join a voice/stage/breakout room' })
  joinToken(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ) {
    return this.roomsService.joinRoomToken(
      user.sub,
      communityId,
      roomId,
      user.role,
      user.email,
    );
  }

  @Post('communities/:communityId/rooms/:roomId/raise-hand')
  @ApiOperation({ summary: 'Raise hand in a stage room' })
  raiseHand(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ) {
    return this.roomsService.raiseHand(user.sub, communityId, roomId, user.role);
  }

  @Delete('communities/:communityId/rooms/:roomId/raise-hand')
  @ApiOperation({ summary: 'Lower hand in a stage room' })
  lowerHand(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ) {
    return this.roomsService.lowerHand(user.sub, communityId, roomId, user.role);
  }

  @Get('communities/:communityId/rooms/:roomId/raise-hands')
  @ApiOperation({ summary: 'List raised hands (hosts only)' })
  listRaisedHands(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ) {
    return this.roomsService.listRaisedHands(user.sub, communityId, roomId, user.role);
  }

  @Post('communities/:communityId/rooms/:roomId/raise-hand/:targetUserId/approve')
  @ApiOperation({ summary: 'Approve a raised hand as stage speaker (hosts only)' })
  approveSpeaker(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Param('targetUserId', ParseUUIDPipe) targetUserId: string,
  ) {
    return this.roomsService.approveStageSpeaker(
      user.sub,
      communityId,
      roomId,
      targetUserId,
      user.role,
    );
  }

  @Post('communities/:communityId/rooms/:roomId/speakers/:targetUserId/remove')
  @ApiOperation({ summary: 'Demote a stage speaker and revoke their live publish rights (hosts only)' })
  removeSpeaker(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Param('targetUserId', ParseUUIDPipe) targetUserId: string,
  ) {
    return this.roomsService.demoteStageSpeaker(
      user.sub,
      communityId,
      roomId,
      targetUserId,
      user.role,
    );
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('communities/:communityId/rooms/:roomId/messages')
  @ApiOperation({ summary: 'List text room messages' })
  listRoomMessages(
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Query('limit') limit = 50,
    @Query('cursor') cursor?: string,
    @Query('parentMessageId') parentMessageId?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.roomMessagesService.listMessages(
      communityId,
      roomId,
      Number(limit) || 50,
      cursor,
      parentMessageId,
      user?.sub,
      user?.role,
    );
  }

  @Post('communities/:communityId/rooms/:roomId/messages')
  @ApiOperation({ summary: 'Send a text room message' })
  sendRoomMessage(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() body: SendCommunityRoomMessageDto,
  ) {
    return this.roomMessagesService.sendMessage(
      communityId,
      roomId,
      user.sub,
      body.body,
      body.parentMessageId,
      user.role,
    );
  }

  @Delete('communities/:communityId/rooms/:roomId/messages/:messageId')
  @ApiOperation({ summary: 'Delete a text room message' })
  deleteRoomMessage(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    return this.roomMessagesService.deleteMessage(
      communityId,
      roomId,
      messageId,
      user.sub,
      user.role,
    );
  }

  @Get('creators/me/communities/:communityId/rooms/:roomId/permissions')
  @UseGuards(CreatorApprovedGuard)
  listRoomPermissions(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ) {
    return this.roomPermissionsService.listPermissions(user.sub, communityId, roomId);
  }

  @Post('creators/me/communities/:communityId/rooms/:roomId/permissions')
  @UseGuards(CreatorApprovedGuard)
  grantRoomPermission(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() body: GrantCommunityRoomPermissionDto,
  ) {
    return this.roomPermissionsService.grantPermission(
      user.sub,
      communityId,
      roomId,
      body.userId,
      body.permission ?? CommunityRoomPermission.SEND,
    );
  }

  @Delete('creators/me/communities/:communityId/rooms/:roomId/permissions/:targetUserId')
  @UseGuards(CreatorApprovedGuard)
  revokeRoomPermission(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Param('targetUserId', ParseUUIDPipe) targetUserId: string,
    @Body() body: RevokeCommunityRoomPermissionDto,
  ) {
    return this.roomPermissionsService.revokePermission(
      user.sub,
      communityId,
      roomId,
      targetUserId,
      body.permission ?? CommunityRoomPermission.SEND,
    );
  }
}
