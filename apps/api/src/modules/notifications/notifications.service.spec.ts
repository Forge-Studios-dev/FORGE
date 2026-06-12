import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationsService } from './notifications.service';
import { Notification, NotificationType } from './entities/notification.entity';
import { DeviceToken } from './entities/device-token.entity';

describe('NotificationsService', () => {
  let service: NotificationsService;
  const notificationRepository = {
    create: jest.fn((dto) => dto),
    save: jest.fn((entity) => Promise.resolve(Array.isArray(entity) ? entity : { id: 'n1', ...entity })),
    insert: jest.fn().mockResolvedValue(undefined),
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const eventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(Notification), useValue: notificationRepository },
        { provide: getRepositoryToken(DeviceToken), useValue: {} },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();
    service = module.get(NotificationsService);
  });

  describe('listForUser', () => {
    it('returns paginated shape with hasMore false for short lists', async () => {
      const rows = [
        {
          id: 'n1',
          userId: 'u1',
          title: 'Hello',
          createdAt: new Date('2026-06-01T12:00:00Z'),
        },
      ];
      const qb = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(rows),
      };
      notificationRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.listForUser('u1');

      expect(result.data).toHaveLength(1);
      expect(result.meta.hasMore).toBe(false);
      expect(result.meta.cursor).toBeNull();
    });
  });

  describe('createMany', () => {
    it('no-ops on empty input', async () => {
      await service.createMany([]);
      expect(notificationRepository.save).not.toHaveBeenCalled();
    });

    it('bulk inserts notifications in one statement per chunk', async () => {
      const inputs = Array.from({ length: 3 }, (_, i) => ({
        userId: `user-${i}`,
        type: NotificationType.STREAM_STARTED_FOLLOWED,
        title: 'Live',
        body: 'Join now',
        metadata: { streamId: 's1' },
      }));

      await service.createMany(inputs);

      expect(notificationRepository.save).toHaveBeenCalledTimes(1);
      expect(notificationRepository.create).toHaveBeenCalledTimes(3);
    });
  });
});
