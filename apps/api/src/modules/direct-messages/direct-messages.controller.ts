import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DirectMessagesService } from './direct-messages.service';
import { SendDirectMessageDto } from './dto/direct-message.dto';
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
    @Param('conversationId') conversationId: string,
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
  markRead(@CurrentUser() user: JwtPayload, @Param('conversationId') conversationId: string) {
    return this.directMessagesService.markRead(user.sub, conversationId);
  }

  @Post('conversations/group')
  @Permissions(Permission.ENGAGE)
  @ApiOperation({ summary: 'Create a group DM channel with 3–25 participants' })
  createGroup(
    @CurrentUser() user: JwtPayload,
    @Body() body: { name: string; memberIds: string[] },
  ) {
    return this.directMessagesService.createGroupConversation(user.sub, body.name, body.memberIds);
  }

  @Post('conversations/:conversationId/members')
  @Permissions(Permission.ENGAGE)
  @ApiOperation({ summary: 'Add a member to a group DM channel' })
  addMember(
    @CurrentUser() user: JwtPayload,
    @Param('conversationId') conversationId: string,
    @Body() body: { userId: string },
  ) {
    return this.directMessagesService.addGroupMember(user.sub, conversationId, body.userId);
  }

  @Post('conversations/:conversationId/messages')
  @Permissions(Permission.ENGAGE)
  @ApiOperation({ summary: 'Send a message to a group DM channel' })
  sendGroupMessage(
    @CurrentUser() user: JwtPayload,
    @Param('conversationId') conversationId: string,
    @Body() body: { content: string },
  ) {
    return this.directMessagesService.sendGroupMessage(user.sub, conversationId, body.content);
  }
}
