import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DirectMessagesService } from './direct-messages.service';
import {
  AddGroupMemberDto,
  CreateGroupDmDto,
  SendDirectMessageDto,
  SendGroupMessageDto,
} from './dto/direct-message.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/auth/permissions';

@ApiTags('Direct Messages')
@Controller('messages')
export class DirectMessagesController {
  constructor(private readonly directMessagesService: DirectMessagesService) {}

  @Get('conversations')
  @Permissions(Permission.ENGAGE)
  @ApiOperation({ summary: 'List DM conversations for current user' })
  listConversations(@CurrentUser() user: JwtPayload) {
    return this.directMessagesService.listConversations(user.sub);
  }

  @Get('conversations/:conversationId')
  @Permissions(Permission.ENGAGE)
  @ApiOperation({ summary: 'Get messages in a conversation' })
  getMessages(
    @CurrentUser() user: JwtPayload,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query('limit') limit?: number,
    @Query('cursor') cursor?: string,
  ) {
    return this.directMessagesService.getMessages(user.sub, conversationId, limit || 50, cursor);
  }

  @Post()
  @Permissions(Permission.ENGAGE)
  @ApiOperation({ summary: 'Send a direct message (creates conversation if needed)' })
  send(@CurrentUser() user: JwtPayload, @Body() dto: SendDirectMessageDto) {
    return this.directMessagesService.sendMessage(user.sub, dto);
  }

  @Post('conversations/:conversationId/read')
  @Permissions(Permission.ENGAGE)
  @ApiOperation({ summary: 'Mark conversation as read' })
  markRead(
    @CurrentUser() user: JwtPayload,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    return this.directMessagesService.markRead(user.sub, conversationId);
  }

  @Post('conversations/group')
  @Permissions(Permission.ENGAGE)
  @ApiOperation({ summary: 'Create a group DM channel with 3–25 participants' })
  createGroup(@CurrentUser() user: JwtPayload, @Body() dto: CreateGroupDmDto) {
    return this.directMessagesService.createGroupConversation(user.sub, dto.name, dto.memberIds);
  }

  @Post('conversations/:conversationId/members')
  @Permissions(Permission.ENGAGE)
  @ApiOperation({ summary: 'Add a member to a group DM channel' })
  addMember(
    @CurrentUser() user: JwtPayload,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: AddGroupMemberDto,
  ) {
    return this.directMessagesService.addGroupMember(user.sub, conversationId, dto.userId);
  }

  @Post('conversations/:conversationId/messages')
  @Permissions(Permission.ENGAGE)
  @ApiOperation({ summary: 'Send a message to a group DM channel' })
  sendGroupMessage(
    @CurrentUser() user: JwtPayload,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: SendGroupMessageDto,
  ) {
    return this.directMessagesService.sendGroupMessage(user.sub, conversationId, dto.content);
  }
}
