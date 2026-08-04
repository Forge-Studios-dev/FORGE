import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { CommunityEventRsvpStatus } from './entities/community-event.entity';
import { CommunityEventsService } from './community-events.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CommunityStudioGuard } from './guards/community-studio.guard';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';

enum CommunityEventType {
  ONE_OFF = 'one_off',
  RECURRING = 'recurring',
  OFFICE_HOURS = 'office_hours',
}

enum CommunityEventRecurrenceRule {
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
}

class CreateCommunityEventDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty()
  @IsDateString()
  startsAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;

  @ApiPropertyOptional({ enum: CommunityEventType })
  @IsOptional()
  @IsEnum(CommunityEventType)
  eventType?: CommunityEventType;

  @ApiPropertyOptional({ enum: CommunityEventRecurrenceRule })
  @IsOptional()
  @IsEnum(CommunityEventRecurrenceRule)
  recurrenceRule?: CommunityEventRecurrenceRule;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  recurrenceUntil?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}

class CommunityEventRsvpDto {
  @ApiPropertyOptional({ enum: CommunityEventRsvpStatus })
  @IsOptional()
  @IsEnum(CommunityEventRsvpStatus)
  status?: CommunityEventRsvpStatus;
}

class UpdateCommunityEventDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;

  @ApiPropertyOptional({ enum: CommunityEventType })
  @IsOptional()
  @IsEnum(CommunityEventType)
  eventType?: CommunityEventType;

  @ApiPropertyOptional({ enum: CommunityEventRecurrenceRule })
  @IsOptional()
  @IsEnum(CommunityEventRecurrenceRule)
  recurrenceRule?: CommunityEventRecurrenceRule | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  recurrenceUntil?: string | null;
}

@ApiTags('Community Events')
@Controller()
export class CommunityEventsController {
  constructor(private readonly eventsService: CommunityEventsService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('communities/:communityId/events')
  @ApiOperation({ summary: 'List community calendar events' })
  list(
    @Param('communityId', ParseUUIDPipe) communityId: string,
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
  listOfficeHours(@Param('communityId', ParseUUIDPipe) communityId: string, @CurrentUser() user?: JwtPayload) {
    return this.eventsService.listOfficeHours(communityId, user?.sub);
  }

  @Post('creators/me/communities/:communityId/events')
  @UseGuards(CommunityStudioGuard)
  @ApiOperation({ summary: 'Create a community event or office hours slot' })
  create(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Body() body: CreateCommunityEventDto,
  ) {
    return this.eventsService.createEvent(user.sub, communityId, body, user.role);
  }

  @Post('communities/:communityId/events/:eventId/rsvp')
  @ApiOperation({ summary: 'RSVP to a community event' })
  rsvp(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() body: CommunityEventRsvpDto,
  ) {
    return this.eventsService.rsvp(
      user.sub,
      communityId,
      eventId,
      body.status ?? CommunityEventRsvpStatus.GOING,
    );
  }

  @Get('creators/me/communities/:communityId/events/:eventId/rsvps')
  @UseGuards(CommunityStudioGuard)
  @ApiOperation({ summary: 'List RSVPs for an event (creator)' })
  listRsvps(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ) {
    return this.eventsService.listRsvps(user.sub, communityId, eventId, user.role);
  }

  @Patch('creators/me/communities/:communityId/events/:eventId')
  @UseGuards(CommunityStudioGuard)
  @ApiOperation({ summary: 'Update a community event' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() body: UpdateCommunityEventDto,
  ) {
    return this.eventsService.updateEvent(user.sub, communityId, eventId, body, user.role);
  }

  @Delete('creators/me/communities/:communityId/events/:eventId')
  @UseGuards(CommunityStudioGuard)
  @ApiOperation({ summary: 'Delete a community event' })
  delete(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ) {
    return this.eventsService.deleteEvent(user.sub, communityId, eventId, user.role);
  }
}
