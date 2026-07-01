import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MentorshipService } from './mentorship.service';
import { MentorshipRole } from './entities/mentorship.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';

@ApiTags('Mentorship')
@Controller('communities/:communityId/mentorship')
export class MentorshipController {
  constructor(private readonly mentorshipService: MentorshipService) {}

  @Get('mentors')
  @ApiOperation({ summary: 'List active mentors in a community' })
  listMentors(@Param('communityId') communityId: string) {
    return this.mentorshipService.listMentors(communityId);
  }

  @Put('profile')
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

  @Get('profile/me')
  @ApiOperation({ summary: 'Get my mentorship profile in a community' })
  myProfile(@CurrentUser() user: JwtPayload, @Param('communityId') communityId: string) {
    return this.mentorshipService.getProfile(user.sub, communityId);
  }

  @Post('run-matching')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Run mentorship matching algorithm (creator/admin only)' })
  runMatching(@Param('communityId') communityId: string) {
    return this.mentorshipService.runMatching(communityId);
  }

  @Get('matches/me')
  @ApiOperation({ summary: 'List my mentorship matches (as mentor and mentee)' })
  myMatches(@CurrentUser() user: JwtPayload, @Param('communityId') communityId: string) {
    return this.mentorshipService.listMyMatches(user.sub, communityId);
  }

  @Post('matches/:matchId/respond')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept or decline a mentorship match (mentor)' })
  respondToMatch(
    @CurrentUser() user: JwtPayload,
    @Param('matchId') matchId: string,
    @Body() body: { accept: boolean },
  ) {
    return this.mentorshipService.respondToMatch(matchId, user.sub, body.accept);
  }

  @Post('matches/:matchId/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a mentorship match as completed' })
  completeMatch(
    @CurrentUser() user: JwtPayload,
    @Param('matchId') matchId: string,
  ) {
    return this.mentorshipService.completeMatch(matchId, user.sub).then(() => ({ ok: true }));
  }
}
