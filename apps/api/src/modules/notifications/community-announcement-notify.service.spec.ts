import { Test, TestingModule } from '@nestjs/testing';
import { CommunityAnnouncementNotifyService } from './community-announcement-notify.service';
import { NotificationsService } from './notifications.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { NotificationType } from './entities/notification.entity';

describe('CommunityAnnouncementNotifyService', () => {
  let service: CommunityAnnouncementNotifyService;
  let notificationsService: { createMany: jest.Mock };
  let entitlementsService: { listSubscribersForCreator: jest.Mock };

  beforeEach(async () => {
    notificationsService = { createMany: jest.fn().mockResolvedValue(undefined) };
    entitlementsService = {
      listSubscribersForCreator: jest
        .fn()
        .mockResolvedValueOnce([{ userId: 'u1' }, { userId: 'u2' }])
        .mockResolvedValueOnce([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityAnnouncementNotifyService,
        { provide: NotificationsService, useValue: notificationsService },
        { provide: EntitlementsService, useValue: entitlementsService },
      ],
    }).compile();

    service = module.get(CommunityAnnouncementNotifyService);
  });

  it('fans out announcement notifications in chunks', async () => {
    await service.fanOut({
      communityId: 'comm-1',
      postId: 'post-1',
      creatorId: 'creator-1',
      title: 'Hello',
      body: 'World',
    });

    expect(notificationsService.createMany).toHaveBeenCalledTimes(1);
    expect(notificationsService.createMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          userId: 'u1',
          type: NotificationType.COMMUNITY_POST_NEW,
        }),
      ]),
    );
    expect(entitlementsService.listSubscribersForCreator).toHaveBeenCalledWith('creator-1', {
      limit: 1000,
      offset: 0,
    });
  });
});
