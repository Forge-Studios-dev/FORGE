import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { PlatformEventOutboxService, PLATFORM_EVENT_TYPES } from './platform-event-outbox.service';
import {
  PlatformEventOutbox,
  PlatformEventOutboxStatus,
} from './entities/platform-event-outbox.entity';
import { PLATFORM_EVENT_OUTBOX_QUEUE } from '../workers/platform-event-outbox/platform-event-outbox.constants';
import { COMMUNITY_ANNOUNCEMENT_NOTIFY_QUEUE } from '../workers/community-announcement-notify/community-announcement-notify.constants';

describe('PlatformEventOutboxService', () => {
  let service: PlatformEventOutboxService;
  const outboxRepository = {
    findOne: jest.fn(),
    save: jest.fn(async (x) => ({ ...x, id: x.id ?? 'evt-1' })),
    create: jest.fn((x) => x),
  };
  const outboxQueue = { add: jest.fn() };
  const announcementQueue = { add: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformEventOutboxService,
        { provide: getRepositoryToken(PlatformEventOutbox), useValue: outboxRepository },
        { provide: getQueueToken(PLATFORM_EVENT_OUTBOX_QUEUE), useValue: outboxQueue },
        { provide: getQueueToken(COMMUNITY_ANNOUNCEMENT_NOTIFY_QUEUE), useValue: announcementQueue },
      ],
    }).compile();

    service = module.get(PlatformEventOutboxService);
  });

  it('appends a pending event and enqueues dispatch', async () => {
    outboxRepository.findOne.mockResolvedValue(null);
    const row = await service.append({
      eventType: PLATFORM_EVENT_TYPES.COMMUNITY_ANNOUNCEMENT_NOTIFY,
      payload: { postId: 'post-1' },
      idempotencyKey: 'announcement:post-1',
    });
    expect(row.id).toBe('evt-1');
    expect(outboxQueue.add).toHaveBeenCalled();
  });

  it('dispatches announcement events to BullMQ', async () => {
    outboxRepository.findOne.mockResolvedValue({
      id: 'evt-1',
      eventType: PLATFORM_EVENT_TYPES.COMMUNITY_ANNOUNCEMENT_NOTIFY,
      payload: { postId: 'post-1', communityId: 'c1', creatorId: 'cr1', title: 'T', body: 'B' },
      status: PlatformEventOutboxStatus.PENDING,
      attempts: 0,
    });
    await service.dispatchEvent('evt-1');
    expect(announcementQueue.add).toHaveBeenCalled();
    expect(outboxRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: PlatformEventOutboxStatus.PROCESSED }),
    );
  });
});
