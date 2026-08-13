import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CommunityEventsService } from './community-events.service';
import {
  CommunityEvent,
  CommunityEventRsvp,
  CommunityEventRsvpStatus,
} from './entities/community-event.entity';
import { CommunitiesService } from './communities.service';

describe('CommunityEventsService', () => {
  let service: CommunityEventsService;

  const event = {
    id: 'evt-1',
    communityId: 'comm-1',
    creatorId: 'creator-1',
    title: 'Office Hours',
    description: null,
    startsAt: new Date('2026-07-01T18:00:00Z'),
    endsAt: null,
    location: null,
    isOnline: true,
    eventType: 'one_off',
    recurrenceRule: null,
    recurrenceUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as CommunityEvent;

  const eventRepository = {
    find: jest.fn().mockResolvedValue([event]),
    findOne: jest.fn(),
    save: jest.fn(async (entity: CommunityEvent) => entity),
    create: jest.fn((dto: Partial<CommunityEvent>) => dto),
    delete: jest.fn(),
  };
  const rsvpRepository = {
    find: jest.fn().mockResolvedValue([]),
    upsert: jest.fn().mockResolvedValue({ identifiers: [{ id: 'rsvp-1' }] }),
    findOne: jest.fn(),
    save: jest.fn(async (entity: CommunityEventRsvp) => ({ ...entity, id: 'rsvp-1' })),
    create: jest.fn((dto: Partial<CommunityEventRsvp>) => dto),
    delete: jest.fn(),
  };
  const communitiesService = {
    assertCommunityAccess: jest.fn().mockResolvedValue(undefined),
    assertCommunityPermission: jest
      .fn()
      .mockResolvedValue({ id: 'comm-1', creatorId: 'creator-1' }),
  };
  const eventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    eventRepository.findOne.mockImplementation(
      async ({ where }: { where: Partial<CommunityEvent> }) => {
        if (where.id === event.id) return event;
        return null;
      },
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityEventsService,
        { provide: getRepositoryToken(CommunityEvent), useValue: eventRepository },
        { provide: getRepositoryToken(CommunityEventRsvp), useValue: rsvpRepository },
        { provide: CommunitiesService, useValue: communitiesService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get(CommunityEventsService);
  });

  it('lists expanded events for community members', async () => {
    const result = await service.listEvents('comm-1', 'user-1');
    expect(communitiesService.assertCommunityAccess).toHaveBeenCalledWith('comm-1', 'user-1');
    expect(result.data.length).toBeGreaterThanOrEqual(1);
  });

  it('creates one-off event via community studio authorization (delegated roles allowed)', async () => {
    const result = await service.createEvent(
      'delegated-admin',
      'comm-1',
      { title: 'AMA', startsAt: '2026-07-02T18:00:00Z' },
      undefined,
    );
    expect(communitiesService.assertCommunityPermission).toHaveBeenCalledWith(
      'delegated-admin',
      'comm-1',
      'manage_events',
      undefined,
    );
    expect(eventRepository.save).toHaveBeenCalled();
    expect(result.data.title).toBe('AMA');
    // event attributed to the community owner, not the delegated creator
    expect(result.data.creatorId).toBe('creator-1');
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'community.event.created',
      expect.objectContaining({ communityId: 'comm-1', creatorId: 'creator-1' }),
    );
  });

  it('rejects event mutation when studio access is denied', async () => {
    communitiesService.assertCommunityPermission.mockRejectedValueOnce(
      new ForbiddenException(),
    );
    await expect(
      service.updateEvent('intruder', 'comm-1', 'evt-1', { title: 'x' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires recurrence rule for recurring events', async () => {
    await expect(
      service.createEvent('creator-1', 'comm-1', {
        title: 'Weekly',
        startsAt: '2026-07-02T18:00:00Z',
        eventType: 'recurring',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rsvps to event idempotently via upsert (no duplicate-key 500 on re-RSVP)', async () => {
    rsvpRepository.findOne.mockResolvedValueOnce({
      id: 'rsvp-1',
      eventId: 'evt-1',
      userId: 'user-1',
      status: CommunityEventRsvpStatus.GOING,
    } as CommunityEventRsvp);

    const result = await service.rsvp('user-1', 'comm-1', 'evt-1', CommunityEventRsvpStatus.GOING);

    expect(rsvpRepository.upsert).toHaveBeenCalledWith(
      { eventId: 'evt-1', userId: 'user-1', status: CommunityEventRsvpStatus.GOING },
      { conflictPaths: ['eventId', 'userId'] },
    );
    expect(rsvpRepository.save).not.toHaveBeenCalled();
    expect(result.data?.status).toBe(CommunityEventRsvpStatus.GOING);
  });

  it('updates RSVP status on repeat RSVP without inserting a new row', async () => {
    rsvpRepository.findOne.mockResolvedValueOnce({
      id: 'rsvp-1',
      eventId: 'evt-1',
      userId: 'user-1',
      status: CommunityEventRsvpStatus.MAYBE,
    } as CommunityEventRsvp);

    const result = await service.rsvp('user-1', 'comm-1', 'evt-1', CommunityEventRsvpStatus.MAYBE);

    expect(rsvpRepository.upsert).toHaveBeenCalledTimes(1);
    expect(result.data?.status).toBe(CommunityEventRsvpStatus.MAYBE);
  });

  it('throws when rsvp target missing', async () => {
    eventRepository.findOne.mockResolvedValue(null);
    await expect(service.rsvp('user-1', 'comm-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deletes event and rsvps', async () => {
    const result = await service.deleteEvent('creator-1', 'comm-1', 'evt-1');
    expect(rsvpRepository.delete).toHaveBeenCalledWith({ eventId: 'evt-1' });
    expect(result.deleted).toBe(true);
  });
});
