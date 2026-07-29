import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MentorshipService } from './mentorship.service';
import { MentorshipRole } from './entities/mentorship.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { clampLimit } from '../../common/utils/pagination.util';

@ApiTags('Mentorship')
@Controller()
export class MentorshipController {
  constructor(private readonly mentorshipService: MentorshipService) {}

  @Roles(UserRole.ADMIN)
  @Get('admin/mentorship/overview')
  @ApiOperation({ summary: 'Platform mentorship match overview (admin)' })
  adminOverview(@Query('limit') limit = 50) {
    return this.mentorshipService.adminOverview(clampLimit(limit, 50, 100));
  }

  @Get('communities/:communityId/mentorship/mentors')
  @ApiOperation({ summary: 'List active mentors in a community' })
  listMentors(@Param('communityId') communityId: string) {
    return this.mentorshipService.listMentors(communityId);
  }

  @Put('communities/:communityId/mentorship/profile')
  @ApiOperation({ summary: 'Create or update my mentorship profile' })
  upsertProfile(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Body()
    body: {
      role: MentorshipRole;
      skills?: string[];
      goals?: string;
      maxMentees?: number;
      bio?: string;
    },
  ) {
    return this.mentorshipService.upsertProfile(user.sub, communityId, body);
  }

  @Get('communities/:communityId/mentorship/profile/me')
  @ApiOperation({ summary: 'Get my mentorship profile in a community' })
  myProfile(@CurrentUser() user: JwtPayload, @Param('communityId') communityId: string) {
    return this.mentorshipService.getProfile(user.sub, communityId);
  }

  @Post('communities/:communityId/mentorship/run-matching')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Run mentorship matching algorithm (community owner only)' })
  runMatching(@CurrentUser() user: JwtPayload, @Param('communityId') communityId: string) {
    return this.mentorshipService.runMatching(user.sub, communityId);
  }

  @Get('communities/:communityId/mentorship/matches')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'List mentorship matches for a community (owner only)' })
  listMatches(@CurrentUser() user: JwtPayload, @Param('communityId') communityId: string) {
    return this.mentorshipService.listCommunityMatches(user.sub, communityId);
  }

  @Get('communities/:communityId/mentorship/matches/me')
  @ApiOperation({ summary: 'List my mentorship matches (as mentor and mentee)' })
  myMatches(@CurrentUser() user: JwtPayload, @Param('communityId') communityId: string) {
    return this.mentorshipService.listMyMatches(user.sub, communityId);
  }

  @Post('communities/:communityId/mentorship/matches/:matchId/respond')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept or decline a mentorship match (mentor)' })
  respondToMatch(
    @CurrentUser() user: JwtPayload,
    @Param('matchId') matchId: string,
    @Body() body: { accept: boolean },
  ) {
    return this.mentorshipService.respondToMatch(matchId, user.sub, body.accept);
  }

  @Post('communities/:communityId/mentorship/matches/:matchId/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a mentorship match as completed' })
  completeMatch(@CurrentUser() user: JwtPayload, @Param('matchId') matchId: string) {
    return this.mentorshipService.completeMatch(matchId, user.sub).then(() => ({ ok: true }));
  }
}
