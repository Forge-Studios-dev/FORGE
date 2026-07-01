import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { StreamChatService } from './stream-chat.service';
import { SubmitQuestionDto, SetQuestionStatusDto } from './dto/stream-qa.dto';
import { StreamQuestionStatus } from './entities/stream-message.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';

@ApiTags('Stream Q&A')
@Controller('streams/:streamId/qa')
export class StreamQaController {
  constructor(private readonly streamChatService: StreamChatService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'List Q&A questions for a stream (sorted by upvotes)' })
  list(
    @Param('streamId') streamId: string,
    @Query('status') status?: StreamQuestionStatus,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.streamChatService.listQuestions(streamId, status, user?.sub, user?.role);
  }

  @Post()
  @ApiOperation({ summary: 'Submit a question to the stream Q&A' })
  submit(
    @Param('streamId') streamId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SubmitQuestionDto,
  ) {
    return this.streamChatService.submitQuestion(streamId, user.sub, dto, user.role);
  }

  @Post(':questionId/upvote')
  @ApiOperation({ summary: 'Toggle an upvote on a question' })
  upvote(
    @Param('streamId') streamId: string,
    @Param('questionId') questionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.streamChatService.upvoteQuestion(streamId, questionId, user.sub, user.role);
  }

  @Patch(':questionId/status')
  @ApiOperation({ summary: 'Set a question status (owner or delegated moderator)' })
  setStatus(
    @Param('streamId') streamId: string,
    @Param('questionId') questionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SetQuestionStatusDto,
  ) {
    return this.streamChatService.setQuestionStatus(
      streamId,
      questionId,
      dto.status,
      user.sub,
      user.role,
    );
  }
}
