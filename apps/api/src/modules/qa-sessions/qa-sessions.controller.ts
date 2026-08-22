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
import { IsISO8601, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { QaSessionsService } from './qa-sessions.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';

class CreateQaSessionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  communityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;
}

class UpdateQaSessionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;
}

class SubmitQuestionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  body: string;
}

@ApiTags('Q&A Sessions')
@Controller()
export class QaSessionsController {
  constructor(private readonly qaSessionsService: QaSessionsService) {}

  @Post('creators/me/qa-sessions')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Create a scheduled Q&A session' })
  create(@CurrentUser() user: JwtPayload, @Body() body: CreateQaSessionDto) {
    return this.qaSessionsService.createSession(user.sub, body);
  }

  @Patch('creators/me/qa-sessions/:sessionId')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Update a Q&A session' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() body: UpdateQaSessionDto,
  ) {
    return this.qaSessionsService.updateSession(user.sub, sessionId, body);
  }

  @Post('creators/me/qa-sessions/:sessionId/start')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Go live with a Q&A session' })
  start(@CurrentUser() user: JwtPayload, @Param('sessionId', ParseUUIDPipe) sessionId: string) {
    return this.qaSessionsService.startSession(user.sub, sessionId);
  }

  @Post('creators/me/qa-sessions/:sessionId/end')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'End a Q&A session' })
  end(@CurrentUser() user: JwtPayload, @Param('sessionId', ParseUUIDPipe) sessionId: string) {
    return this.qaSessionsService.endSession(user.sub, sessionId);
  }

  @Delete('creators/me/qa-sessions/:sessionId')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Delete a Q&A session' })
  remove(@CurrentUser() user: JwtPayload, @Param('sessionId', ParseUUIDPipe) sessionId: string) {
    return this.qaSessionsService.deleteSession(user.sub, sessionId);
  }

  @Get('creators/me/qa-sessions')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'List my Q&A sessions (studio)' })
  listForCreator(@CurrentUser() user: JwtPayload) {
    return this.qaSessionsService.listForCreator(user.sub);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('creators/:creatorId/qa-sessions')
  @ApiOperation({ summary: "List a creator's Q&A sessions (consumer)" })
  listPublic(
    @Param('creatorId', ParseUUIDPipe) creatorId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.qaSessionsService.listPublic(creatorId, { page, limit });
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('qa-sessions/:sessionId')
  @ApiOperation({ summary: 'Get a Q&A session' })
  getSession(@Param('sessionId', ParseUUIDPipe) sessionId: string) {
    return this.qaSessionsService.getSession(sessionId);
  }

  @Post('qa-sessions/:sessionId/questions')
  @ApiOperation({ summary: 'Submit a question to a Q&A session' })
  submitQuestion(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() body: SubmitQuestionDto,
  ) {
    return this.qaSessionsService.submitQuestion(sessionId, user.sub, body.body);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('qa-sessions/:sessionId/questions')
  @ApiOperation({ summary: 'List questions for a Q&A session' })
  listQuestions(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Query('sort') sort?: string,
  ) {
    return this.qaSessionsService.listQuestions(sessionId, sort === 'new' ? 'new' : 'top');
  }

  @Post('qa-sessions/:sessionId/questions/:questionId/upvote')
  @ApiOperation({ summary: 'Toggle an upvote on a question' })
  toggleUpvote(
    @CurrentUser() user: JwtPayload,
    @Param('questionId', ParseUUIDPipe) questionId: string,
  ) {
    return this.qaSessionsService.toggleUpvote(questionId, user.sub);
  }

  @Post('creators/me/qa-sessions/:sessionId/questions/:questionId/answer')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Mark a question as answered' })
  markAnswered(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
  ) {
    return this.qaSessionsService.markAnswered(user.sub, sessionId, questionId);
  }

  @Delete('creators/me/qa-sessions/:sessionId/questions/:questionId')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Dismiss a question' })
  dismissQuestion(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
  ) {
    return this.qaSessionsService.dismissQuestion(user.sub, sessionId, questionId);
  }
}
