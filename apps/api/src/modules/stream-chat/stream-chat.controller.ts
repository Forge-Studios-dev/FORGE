import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { StreamChatService } from './stream-chat.service';
import { PinMessageDto, SendStreamChatDto, TimeoutUserDto } from './dto/stream-chat.dto';
import { SendSuperChatDto } from './dto/send-super-chat.dto';
import { SetSlowModeDto } from '../streaming/dto/set-slow-mode.dto';
import { SetStreamChatSettingsDto } from '../streaming/dto/set-stream-chat-settings.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';

@ApiTags('Stream Chat')
@Controller('streams/:streamId/chat')
export class StreamChatController {
  constructor(private readonly streamChatService: StreamChatService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Get stream chat history' })
  getMessages(
    @Param('streamId') streamId: string,
    @Query('limit') limit = 50,
    @Query('cursor') cursor?: string,
    @Query('fromMs') fromMs?: string,
    @Query('toMs') toMs?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    const replayWindow =
      fromMs != null || toMs != null
        ? {
            fromMs: fromMs != null ? Number(fromMs) : undefined,
            toMs: toMs != null ? Number(toMs) : undefined,
          }
        : undefined;

    return this.streamChatService.getMessages(
      streamId,
      Number(limit) || 50,
      cursor,
      user?.sub,
      user?.role,
      replayWindow,
    );
  }

  @Post('super-chat')
  @ApiOperation({ summary: 'Send a super chat (tip) message' })
  sendSuperChat(
    @Param('streamId') streamId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SendSuperChatDto,
  ) {
    return this.streamChatService.sendSuperChat(streamId, user.sub, dto, user.role);
  }

  @Post()
  @ApiOperation({ summary: 'Send a chat message' })
  sendMessage(
    @Param('streamId') streamId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SendStreamChatDto,
  ) {
    return this.streamChatService.sendMessage(streamId, user.sub, dto, user.role);
  }

  @Delete(':messageId')
  @ApiOperation({ summary: 'Delete a chat message' })
  deleteMessage(
    @Param('streamId') streamId: string,
    @Param('messageId') messageId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.streamChatService.deleteMessage(streamId, messageId, user.sub, user.role);
  }

  @Post('timeout')
  @ApiOperation({ summary: 'Timeout a user from chat' })
  timeoutUser(
    @Param('streamId') streamId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: TimeoutUserDto,
  ) {
    return this.streamChatService.timeoutUser(streamId, user.sub, dto, user.role);
  }

  @Post('ban')
  @ApiOperation({ summary: 'Ban a user from chat' })
  banUser(
    @Param('streamId') streamId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: TimeoutUserDto,
  ) {
    return this.streamChatService.banUser(streamId, user.sub, dto, user.role);
  }

  @Post('unban')
  @ApiOperation({ summary: 'Unban a user from chat' })
  unbanUser(
    @Param('streamId') streamId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: TimeoutUserDto,
  ) {
    return this.streamChatService.unbanUser(streamId, user.sub, dto, user.role);
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Update chat settings (owner or delegated moderator)' })
  setChatSettings(
    @Param('streamId') streamId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SetStreamChatSettingsDto,
  ) {
    return this.streamChatService.setChatSettings(streamId, user.sub, dto, user.role);
  }

  @Patch('pin')
  @ApiOperation({ summary: 'Pin or unpin a chat message' })
  pinMessage(
    @Param('streamId') streamId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: PinMessageDto,
  ) {
    return this.streamChatService.setPinnedMessage(
      streamId,
      user.sub,
      dto.messageId ?? null,
      user.role,
    );
  }

  @Patch('slow-mode')
  @ApiOperation({ summary: 'Set chat slow mode (owner or delegated moderator)' })
  setSlowMode(
    @Param('streamId') streamId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SetSlowModeDto,
  ) {
    return this.streamChatService.setSlowMode(
      streamId,
      user.sub,
      dto.slowModeSeconds,
      user.role,
    );
  }
}
