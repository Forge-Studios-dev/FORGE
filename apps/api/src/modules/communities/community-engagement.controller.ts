import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommunityEngagementService } from './community-engagement.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';

@ApiTags('Community Engagement')
@Controller()
export class CommunityEngagementController {
  constructor(private readonly engagementService: CommunityEngagementService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('communities/:communityId/wiki')
  @ApiOperation({ summary: 'List community wiki pages' })
  listWiki(@Param('communityId') communityId: string, @CurrentUser() user?: JwtPayload) {
    return this.engagementService.listWiki(communityId, user?.sub, user?.role);
  }

  @Post('creators/me/communities/:communityId/wiki')
  @UseGuards(CreatorApprovedGuard)
  createWiki(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Body() body: { title: string; body?: string; sortOrder?: number },
  ) {
    return this.engagementService.createWiki(user.sub, communityId, body);
  }

  @Patch('creators/me/communities/:communityId/wiki/:wikiId')
  @UseGuards(CreatorApprovedGuard)
  updateWiki(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('wikiId') wikiId: string,
    @Body() body: { title?: string; body?: string; sortOrder?: number },
  ) {
    return this.engagementService.updateWiki(user.sub, communityId, wikiId, body);
  }

  @Delete('creators/me/communities/:communityId/wiki/:wikiId')
  @UseGuards(CreatorApprovedGuard)
  deleteWiki(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('wikiId') wikiId: string,
  ) {
    return this.engagementService.deleteWiki(user.sub, communityId, wikiId);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('communities/:communityId/challenges')
  listChallenges(@Param('communityId') communityId: string, @CurrentUser() user?: JwtPayload) {
    return this.engagementService.listChallenges(communityId, user?.sub, user?.role);
  }

  @Post('creators/me/communities/:communityId/challenges')
  @UseGuards(CreatorApprovedGuard)
  createChallenge(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Body() body: { title: string; description?: string; startsAt?: string; endsAt?: string },
  ) {
    return this.engagementService.createChallenge(user.sub, communityId, body);
  }

  @Patch('creators/me/communities/:communityId/challenges/:challengeId')
  @UseGuards(CreatorApprovedGuard)
  updateChallenge(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('challengeId') challengeId: string,
    @Body()
    body: {
      title?: string;
      description?: string;
      startsAt?: string;
      endsAt?: string;
      isActive?: boolean;
    },
  ) {
    return this.engagementService.updateChallenge(user.sub, communityId, challengeId, body);
  }

  @Delete('creators/me/communities/:communityId/challenges/:challengeId')
  @UseGuards(CreatorApprovedGuard)
  deleteChallenge(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('challengeId') challengeId: string,
  ) {
    return this.engagementService.deleteChallenge(user.sub, communityId, challengeId);
  }

  @Post('communities/:communityId/challenges/:challengeId/join')
  joinChallenge(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('challengeId') challengeId: string,
  ) {
    return this.engagementService.joinChallenge(user.sub, communityId, challengeId, user.role);
  }

  @Patch('communities/:communityId/challenges/:challengeId/progress')
  updateChallengeProgress(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('challengeId') challengeId: string,
    @Body() body: { progressPercent: number },
  ) {
    return this.engagementService.updateChallengeProgress(
      user.sub,
      communityId,
      challengeId,
      body.progressPercent ?? 0,
      user.role,
    );
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('communities/:communityId/surveys')
  listSurveys(@Param('communityId') communityId: string, @CurrentUser() user?: JwtPayload) {
    return this.engagementService.listSurveys(communityId, user?.sub, user?.role);
  }

  @Post('creators/me/communities/:communityId/surveys')
  @UseGuards(CreatorApprovedGuard)
  createSurvey(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Body()
    body: {
      title: string;
      questions: Array<{ question: string; type?: string; options?: string[] }>;
      closesAt?: string;
    },
  ) {
    return this.engagementService.createSurvey(user.sub, communityId, body);
  }

  @Patch('creators/me/communities/:communityId/surveys/:surveyId')
  @UseGuards(CreatorApprovedGuard)
  updateSurvey(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('surveyId') surveyId: string,
    @Body()
    body: {
      title?: string;
      questions?: Array<{ question: string; type?: string; options?: string[] }>;
      closesAt?: string;
      isActive?: boolean;
    },
  ) {
    return this.engagementService.updateSurvey(user.sub, communityId, surveyId, body);
  }

  @Delete('creators/me/communities/:communityId/surveys/:surveyId')
  @UseGuards(CreatorApprovedGuard)
  deleteSurvey(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('surveyId') surveyId: string,
  ) {
    return this.engagementService.deleteSurvey(user.sub, communityId, surveyId);
  }

  @Get('creators/me/communities/:communityId/surveys/:surveyId/analytics')
  @UseGuards(CreatorApprovedGuard)
  surveyAnalytics(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('surveyId') surveyId: string,
  ) {
    return this.engagementService.getSurveyAnalytics(user.sub, communityId, surveyId);
  }

  @Post('communities/:communityId/surveys/:surveyId/respond')
  respondSurvey(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('surveyId') surveyId: string,
    @Body() body: { answers: unknown[] },
  ) {
    return this.engagementService.respondSurvey(
      user.sub,
      communityId,
      surveyId,
      body.answers ?? [],
      user.role,
    );
  }
}
