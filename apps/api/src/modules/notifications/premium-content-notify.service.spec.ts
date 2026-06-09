import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PremiumContentNotifyService } from './premium-content-notify.service';
import { NotificationsService } from './notifications.service';
import { PushDispatchService } from './push-dispatch.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { User } from '../users/entities/user.entity';
import { VideoVisibility } from '../content/entities/video.entity';
import { NotificationType } from './entities/notification.entity';

describe('PremiumContentNotifyService', () => {
  let service: PremiumContentNotifyService;
  const notificationsService = { createMany: jest.fn() };
  const pushDispatch = { enqueueForUsers: jest.fn() };
  const entitlementsService = { listActiveSubscriberUserIds: jest.fn() };
  const userRepository = { findOne: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PremiumContentNotifyService,
        { provide: NotificationsService, useValue: notificationsService },
        { provide: PushDispatchService, useValue: pushDispatch },
        { provide: EntitlementsService, useValue: entitlementsService },
        { provide: getRepositoryToken(User), useValue: userRepository },
      ],
    }).compile();
    service = module.get(PremiumContentNotifyService);
  });

  it('skips public visibility replays', async () => {
    await service.fanOut({
      videoId: 'v1',
      creatorId: 'c1',
      visibility: VideoVisibility.PUBLIC,
      title: 'Replay',
    });
    expect(entitlementsService.listActiveSubscriberUserIds).not.toHaveBeenCalled();
  });

  it('fans out to subscribers for tier content', async () => {
    userRepository.findOne.mockResolvedValue({ displayName: 'Creator' });
    entitlementsService.listActiveSubscriberUserIds.mockResolvedValue(['u1', 'u2']);

    await service.fanOut({
      videoId: 'v1',
      creatorId: 'c1',
      visibility: VideoVisibility.TIER,
      requiredTierId: 'tier-1',
      title: 'Premium replay',
    });

    expect(notificationsService.createMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          userId: 'u1',
          type: NotificationType.PREMIUM_CONTENT_NEW,
        }),
      ]),
    );
    expect(pushDispatch.enqueueForUsers).toHaveBeenCalledWith(['u1', 'u2'], expect.any(Object));
  });
});
