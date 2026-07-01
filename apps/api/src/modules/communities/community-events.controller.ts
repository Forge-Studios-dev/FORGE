import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommunityEventRsvpStatus } from './entities/community-event.entity';
import { CommunityEventsService } from './community-events.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CommunityStudioGuard } from './guards/community-studio.guard';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';

@ApiTags('Community Events')
@Controller()
export class CommunityEventsController {
  constructor(private readonly eventsService: CommunityEventsService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('communities/:communityId/events')
  @ApiOperation({ summary: 'List community calendar events' })
  list(
    @Param('communityId') communityId: string,
    @Query('seriesOnly') seriesOnly?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.eventsService.listEvents(communityId, user?.sub, {
      seriesOnly: seriesOnly === '1' || seriesOnly === 'true',
    });
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('communities/:communityId/office-hours')
  @ApiOperation({ summary: 'List creator office hours slots with booking availability' })
  listOfficeHours(@Param('communityId') communityId: string, @CurrentUser() user?: JwtPayload) {
    return this.eventsService.listOfficeHours(communityId, user?.sub);
  }

  @Post('creators/me/communities/:communityId/events')
  @UseGuards(CommunityStudioGuard)
  @ApiOperation({ summary: 'Create a community event or office hours slot' })
  create(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Body()
    body: {
      title: string;
      description?: string;
      startsAt: string;
      endsAt?: string;
      location?: string;
      isOnline?: boolean;
      eventType?: 'one_off' | 'recurring' | 'office_hours';
      recurrenceRule?: 'weekly' | 'biweekly' | 'monthly';
      recurrenceUntil?: string;
      capacity?: number;
    },
  ) {
    return this.eventsService.createEvent(user.sub, communityId, body, user.role);
  }

  @Post('communities/:communityId/events/:eventId/rsvp')
  @ApiOperation({ summary: 'RSVP to a community event' })
  rsvp(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('eventId') eventId: string,
    @Body() body: { status?: 'going' | 'maybe' | 'not_going' },
  ) {
    return this.eventsService.rsvp(
      user.sub,
      communityId,
      eventId,
      (body.status as CommunityEventRsvpStatus) ?? CommunityEventRsvpStatus.GOING,
    );
  }

  @Get('creators/me/communities/:communityId/events/:eventId/rsvps')
  @UseGuards(CommunityStudioGuard)
  @ApiOperation({ summary: 'List RSVPs for an event (creator)' })
  listRsvps(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('eventId') eventId: string,
  ) {
    return this.eventsService.listRsvps(user.sub, communityId, eventId, user.role);
  }

  @Patch('creators/me/communities/:communityId/events/:eventId')
  @UseGuards(CommunityStudioGuard)
  @ApiOperation({ summary: 'Update a community event' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('eventId') eventId: string,
    @Body()
    body: {
      title?: string;
      description?: string;
      startsAt?: string;
      endsAt?: string | null;
      location?: string | null;
      isOnline?: boolean;
      eventType?: 'one_off' | 'recurring';
      recurrenceRule?: 'weekly' | 'biweekly' | 'monthly' | null;
      recurrenceUntil?: string | null;
    },
  ) {
    return this.eventsService.updateEvent(user.sub, communityId, eventId, body, user.role);
  }

  @Delete('creators/me/communities/:communityId/events/:eventId')
  @UseGuards(CommunityStudioGuard)
  @ApiOperation({ summary: 'Delete a community event' })
  delete(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('eventId') eventId: string,
  ) {
    return this.eventsService.deleteEvent(user.sub, communityId, eventId, user.role);
  }
}
