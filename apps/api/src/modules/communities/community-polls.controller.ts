import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommunityPollsService } from './community-polls.service';
import { CreateCommunityPollDto, VoteCommunityPollDto } from './dto/community-poll.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Community Polls')
@Controller()
export class CommunityPollsController {
  constructor(private readonly pollsService: CommunityPollsService) {}

  @Post('creators/me/communities/:communityId/polls')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Create a community poll (closes any active poll)' })
  create(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Body() dto: CreateCommunityPollDto,
  ) {
    return this.pollsService.createPoll(user.sub, communityId, user.sub, dto);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('communities/:communityId/polls/active')
  @ApiOperation({ summary: 'Get active community poll' })
  getActive(
    @Param('communityId') communityId: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.pollsService.getActivePoll(communityId, user?.sub, user?.role);
  }

  @Post('communities/:communityId/polls/:pollId/vote')
  @ApiOperation({ summary: 'Vote on a community poll' })
  vote(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('pollId') pollId: string,
    @Body() dto: VoteCommunityPollDto,
  ) {
    return this.pollsService.votePoll(communityId, pollId, user.sub, dto.optionIndex, user.role);
  }

  @Post('creators/me/communities/:communityId/polls/:pollId/close')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Close a community poll' })
  close(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('pollId') pollId: string,
  ) {
    return this.pollsService.closePoll(user.sub, communityId, pollId);
  }
}
