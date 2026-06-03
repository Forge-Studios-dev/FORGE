import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { StreamChatService } from './stream-chat.service';
import { SendStreamChatDto, TimeoutUserDto } from './dto/stream-chat.dto';
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
  ) {
    return this.streamChatService.getMessages(streamId, Number(limit) || 50, cursor);
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
}
