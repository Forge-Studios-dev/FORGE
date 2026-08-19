import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, Repository } from 'typeorm';
import {
  CommunityEvent,
  CommunityEventRsvp,
  CommunityEventRsvpStatus,
} from './entities/community-event.entity';
import { CommunitiesService } from './communities.service';
import { expandCommunityEvents } from './community-event-recurrence.util';
import { UserRole } from '../users/entities/user.entity';

type EventInput = {
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  isOnline?: boolean;
  eventType?: 'one_off' | 'recurring' | 'office_hours';
  recurrenceRule?: 'weekly' | 'biweekly' | 'monthly' | null;
  recurrenceUntil?: string | null;
  capacity?: number | null;
};

@Injectable()
export class CommunityEventsService {
  constructor(
    @InjectRepository(CommunityEvent)
    private readonly eventRepository: Repository<CommunityEvent>,
    @InjectRepository(CommunityEventRsvp)
    private readonly rsvpRepository: Repository<CommunityEventRsvp>,
    @Inject(forwardRef(() => CommunitiesService))
    private readonly communitiesService: CommunitiesService,
    private readonly eventEmitter: EventEmitter2,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async listEvents(
    communityId: string,
    viewerId?: string | null,
    options?: { seriesOnly?: boolean },
  ) {
    await this.communitiesService.assertCommunityAccess(communityId, viewerId ?? null);
    const events = await this.eventRepository.find({
      where: { communityId },
      order: { startsAt: 'ASC' },
      take: 100,
    });
    if (options?.seriesOnly) {
      return {
        data: events.map((event) => ({
          ...event,
          seriesEventId: event.id,
          occurrenceStartsAt: event.startsAt.toISOString(),
          occurrenceEndsAt: event.endsAt?.toISOString() ?? null,
          isRecurrenceInstance: false,
        })),
      };
    }
    const expanded = expandCommunityEvents(events);
    return { data: expanded };
  }

  async createEvent(
    actorId: string,
    communityId: string,
    input: EventInput,
    viewerRole?: UserRole | null,
  ) {
    // Community-scoped authorization: owner + delegated OWNER/ADMIN/MODERATOR/COACH
    // (all hold `manage_events` per COMMUNITY_ROLE_PERMISSION_MATRIX) + platform ADMIN.
    const community = await this.communitiesService.assertCommunityPermission(
      actorId,
      communityId,
      'manage_events',
      viewerRole,
    );
    const eventType = input.eventType ?? 'one_off';
    if (eventType === 'recurring' && !input.recurrenceRule) {
      throw new BadRequestException('recurrenceRule required for recurring events');
    }
    const capacity =
      eventType === 'office_hours' && input.capacity != null
        ? Math.max(1, Math.floor(input.capacity))
        : null;
    const event = await this.eventRepository.save(
      this.eventRepository.create({
        communityId,
        // Attribute the event to the community owner regardless of which
        // delegated manager created it, so ownership stays stable.
        creatorId: community.creatorId,
        title: input.title.trim(),
        description: input.description?.trim() ?? null,
        startsAt: new Date(input.startsAt),
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        location: input.location?.trim() ?? null,
        isOnline: input.isOnline ?? true,
        eventType,
        recurrenceRule: eventType === 'recurring' ? input.recurrenceRule ?? null : null,
        recurrenceUntil:
          eventType === 'recurring' && input.recurrenceUntil
            ? new Date(input.recurrenceUntil)
            : null,
        capacity,
      }),
    );
    this.eventEmitter.emit('community.event.created', {
      communityId,
      eventId: event.id,
      creatorId: community.creatorId,
    });
    return { data: event };
  }

  async rsvp(userId: string, communityId: string, eventId: string, status = CommunityEventRsvpStatus.GOING) {
    await this.communitiesService.assertCommunityAccess(communityId, userId);
    const event = await this.eventRepository.findOne({ where: { id: eventId, communityId } });
    if (!event) throw new NotFoundException('Event not found');

    // Enforce capacity for office_hours slots: check GOING count before booking.
    if (
      event.eventType === 'office_hours' &&
      event.capacity != null &&
      status === CommunityEventRsvpStatus.GOING
    ) {
      // count-then-upsert is a TOCTOU race — two simultaneous RSVPs for the
      // last open slot could both read goingCount < capacity and both book,
      // overbooking it. Same fix shape as AccountStrikesService.issueStrike:
      // an advisory lock scoped to this event serializes concurrent RSVPs.
      await this.dataSource.transaction(async (manager) => {
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          `community-event-rsvp:${eventId}`,
        ]);

        const existing = await manager.findOne(CommunityEventRsvp, { where: { eventId, userId } });
        if (!existing || existing.status !== CommunityEventRsvpStatus.GOING) {
          const goingCount = await manager.count(CommunityEventRsvp, {
            where: { eventId, status: CommunityEventRsvpStatus.GOING },
          });
          if (goingCount >= event.capacity!) {
            throw new BadRequestException('This office hours slot is fully booked');
          }
        }

        // Idempotent + race-safe: a member may change their RSVP or double-submit.
        // The (event_id, user_id) unique constraint means a plain INSERT would 500 on
        // the second call, so upsert the status instead.
        await manager.upsert(
          CommunityEventRsvp,
          { eventId, userId, status },
          { conflictPaths: ['eventId', 'userId'] },
        );
      });
    } else {
      await this.rsvpRepository.upsert(
        { eventId, userId, status },
        { conflictPaths: ['eventId', 'userId'] },
      );
    }
    const row = await this.rsvpRepository.findOne({ where: { eventId, userId } });
    this.eventEmitter.emit('community.event.rsvp', { communityId, eventId, userId });
    return { data: row };
  }

  async listOfficeHours(communityId: string, viewerId?: string | null) {
    await this.communitiesService.assertCommunityAccess(communityId, viewerId ?? null);
    const slots = await this.eventRepository.find({
      where: { communityId, eventType: 'office_hours' },
      order: { startsAt: 'ASC' },
      take: 50,
    });
    const slotIds = slots.map((s) => s.id);
    if (slotIds.length === 0) return { data: [] };

    const bookingCounts = await this.rsvpRepository
      .createQueryBuilder('r')
      .select('r.eventId', 'eventId')
      .addSelect('COUNT(*)', 'count')
      .where('r.eventId IN (:...slotIds)', { slotIds })
      .andWhere('r.status = :status', { status: CommunityEventRsvpStatus.GOING })
      .groupBy('r.eventId')
      .getRawMany<{ eventId: string; count: string }>();

    const countMap = new Map(bookingCounts.map((r) => [r.eventId, parseInt(r.count, 10)]));

    return {
      data: slots.map((slot) => {
        const booked = countMap.get(slot.id) ?? 0;
        return {
          ...slot,
          bookedCount: booked,
          remainingSlots: slot.capacity != null ? Math.max(0, slot.capacity - booked) : null,
          isFull: slot.capacity != null && booked >= slot.capacity,
        };
      }),
    };
  }

  async listRsvps(
    actorId: string,
    communityId: string,
    eventId: string,
    viewerRole?: UserRole | null,
  ) {
    await this.communitiesService.assertCommunityPermission(actorId, communityId, 'manage_events', viewerRole);
    const event = await this.eventRepository.findOne({ where: { id: eventId, communityId } });
    if (!event) throw new NotFoundException('Event not found');
    const rows = await this.rsvpRepository.find({ where: { eventId }, take: 200 });
    return { data: rows };
  }

  async updateEvent(
    actorId: string,
    communityId: string,
    eventId: string,
    input: Partial<EventInput>,
    viewerRole?: UserRole | null,
  ) {
    await this.communitiesService.assertCommunityPermission(actorId, communityId, 'manage_events', viewerRole);
    const event = await this.eventRepository.findOne({ where: { id: eventId, communityId } });
    if (!event) throw new NotFoundException('Event not found');
    if (input.title !== undefined) event.title = input.title.trim();
    if (input.description !== undefined) event.description = input.description?.trim() ?? null;
    if (input.startsAt !== undefined) event.startsAt = new Date(input.startsAt);
    if (input.endsAt !== undefined) event.endsAt = input.endsAt ? new Date(input.endsAt) : null;
    if (input.location !== undefined) event.location = input.location?.trim() ?? null;
    if (input.isOnline !== undefined) event.isOnline = input.isOnline;
    if (input.eventType !== undefined) {
      event.eventType = input.eventType;
      if (input.eventType === 'one_off') {
        event.recurrenceRule = null;
        event.recurrenceUntil = null;
      }
    }
    if (input.recurrenceRule !== undefined) event.recurrenceRule = input.recurrenceRule;
    if (input.recurrenceUntil !== undefined) {
      event.recurrenceUntil = input.recurrenceUntil ? new Date(input.recurrenceUntil) : null;
    }
    if (event.eventType === 'recurring' && !event.recurrenceRule) {
      throw new BadRequestException('recurrenceRule required for recurring events');
    }
    const saved = await this.eventRepository.save(event);
    return { data: saved };
  }

  async deleteEvent(
    actorId: string,
    communityId: string,
    eventId: string,
    viewerRole?: UserRole | null,
  ) {
    await this.communitiesService.assertCommunityPermission(actorId, communityId, 'manage_events', viewerRole);
    const event = await this.eventRepository.findOne({ where: { id: eventId, communityId } });
    if (!event) throw new NotFoundException('Event not found');
    await this.rsvpRepository.delete({ eventId });
    await this.eventRepository.delete(eventId);
    return { deleted: true, id: eventId };
  }
}
