import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { PushDispatchService } from './push-dispatch.service';
import { DeviceToken } from './entities/device-token.entity';
import { User } from '../users/entities/user.entity';
import { PUSH_DISPATCH_QUEUE } from './push-dispatch.constants';
import { FirebaseService } from '../firebase/firebase.service';

describe('PushDispatchService', () => {
  let service: PushDispatchService;
  const pushQueue = { add: jest.fn(), addBulk: jest.fn().mockResolvedValue(undefined) };
  const deviceTokenRepository = {
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const userRepository = {
    find: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const qb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]),
    };
    deviceTokenRepository.createQueryBuilder.mockReturnValue(qb);
    userRepository.find.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushDispatchService,
        { provide: getRepositoryToken(DeviceToken), useValue: deviceTokenRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getQueueToken(PUSH_DISPATCH_QUEUE), useValue: pushQueue },
        { provide: FirebaseService, useValue: { isFcmEnabled: () => true } },
      ],
    }).compile();
    service = module.get(PushDispatchService);
  });

  describe('enqueueForUsers', () => {
    it('skips when FCM disabled', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PushDispatchService,
          { provide: getRepositoryToken(DeviceToken), useValue: deviceTokenRepository },
          { provide: getRepositoryToken(User), useValue: userRepository },
          { provide: getQueueToken(PUSH_DISPATCH_QUEUE), useValue: pushQueue },
          { provide: FirebaseService, useValue: { isFcmEnabled: () => false } },
        ],
      }).compile();
      const disabled = module.get(PushDispatchService);
      await disabled.enqueueForUsers(['u1', 'u2'], { title: 'T', body: 'B', category: 'social' });
      expect(pushQueue.addBulk).not.toHaveBeenCalled();
    });

    it('uses one token lookup and addBulk for many users', async () => {
      await service.enqueueForUsers(['u1', 'u2', 'u3'], {
        title: 'Live',
        body: 'Join',
        data: { type: 'test' },
        category: 'live',
      });

      expect(deviceTokenRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
      expect(pushQueue.addBulk).toHaveBeenCalledTimes(1);
      expect(pushQueue.addBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ data: expect.objectContaining({ userId: 'u1' }) }),
          expect.objectContaining({ data: expect.objectContaining({ userId: 'u2' }) }),
        ]),
      );
    });

    it('excludes recipients who muted the category before the token lookup', async () => {
      userRepository.find.mockResolvedValue([
        { id: 'u1', notificationPreferences: { mutedCategories: ['live'], emailDigest: false } },
      ]);

      await service.enqueueForUsers(['u1', 'u2'], { title: 'Live', body: 'Join', category: 'live' });

      expect(deviceTokenRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
      const qb = deviceTokenRepository.createQueryBuilder.mock.results[0].value;
      expect(qb.where).toHaveBeenCalledWith('dt.user_id IN (:...userIds)', { userIds: ['u2'] });
    });

    it('no-ops entirely when every recipient muted the category', async () => {
      userRepository.find.mockResolvedValue([
        { id: 'u1', notificationPreferences: { mutedCategories: ['live'], emailDigest: false } },
      ]);

      await service.enqueueForUsers(['u1'], { title: 'Live', body: 'Join', category: 'live' });

      expect(deviceTokenRepository.createQueryBuilder).not.toHaveBeenCalled();
      expect(pushQueue.addBulk).not.toHaveBeenCalled();
    });
  });
});
