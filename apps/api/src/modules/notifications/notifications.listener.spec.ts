import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationsListener } from './notifications.listener';
import { NotificationsService } from './notifications.service';
import { PushDispatchService } from './push-dispatch.service';
import { MailService } from '../mail/mail.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { PremiumContentNotifyService } from './premium-content-notify.service';
import { EngagementService } from '../engagement/engagement.service';
import { User } from '../users/entities/user.entity';
import { Follow, FollowNotifyLevel } from '../engagement/entities/follow.entity';
import { Comment } from '../engagement/entities/comment.entity';
import { WatchHistory } from '../engagement/entities/watch-history.entity';

describe('NotificationsListener', () => {
  let listener: NotificationsListener;
  const pushDispatch = { enqueueForUsers: jest.fn().mockResolvedValue(undefined) };
  const engagementService = { getBlockedPeerIds: jest.fn().mockResolvedValue([]) };
  const followRepository = { find: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    engagementService.getBlockedPeerIds.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsListener,
        { provide: NotificationsService, useValue: { create: jest.fn() } },
        { provide: PushDispatchService, useValue: pushDispatch },
        { provide: MailService, useValue: { sendMail: jest.fn() } },
        { provide: EntitlementsService, useValue: {} },
        { provide: PremiumContentNotifyService, useValue: {} },
        { provide: EngagementService, useValue: engagementService },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(Follow), useValue: followRepository },
        { provide: getRepositoryToken(Comment), useValue: {} },
        { provide: getRepositoryToken(WatchHistory), useValue: {} },
        { provide: 'default_IORedisModuleConnectionToken', useValue: {} },
      ],
    }).compile();

    listener = module.get(NotificationsListener);
  });

  describe('onStreamReminder', () => {
    it('excludes a blocked-either-way peer from the reminder fan-out, matching notifyAudienceOfLive', async () => {
      followRepository.find.mockResolvedValue([
        { followerId: 'follower-1', notifyLevel: FollowNotifyLevel.ALL },
        { followerId: 'blocked-1', notifyLevel: FollowNotifyLevel.ALL },
      ]);
      engagementService.getBlockedPeerIds.mockResolvedValue(['blocked-1']);

      await listener.onStreamReminder({
        streamId: 's1',
        userId: 'creator-1',
        title: 'Going live',
        rsvpUserIds: ['rsvp-1', 'blocked-1'],
      });

      const [recipients] = pushDispatch.enqueueForUsers.mock.calls[0];
      expect(recipients).toEqual(expect.arrayContaining(['follower-1', 'rsvp-1']));
      expect(recipients).not.toContain('blocked-1');
    });

    it('does not dispatch at all once blocking filters out every recipient', async () => {
      followRepository.find.mockResolvedValue([
        { followerId: 'blocked-1', notifyLevel: FollowNotifyLevel.ALL },
      ]);
      engagementService.getBlockedPeerIds.mockResolvedValue(['blocked-1']);

      await listener.onStreamReminder({
        streamId: 's1',
        userId: 'creator-1',
        title: 'Going live',
      });

      expect(pushDispatch.enqueueForUsers).not.toHaveBeenCalled();
    });

    it('caps the fan-out at FANOUT_RECIPIENT_LIMIT even with a huge rsvp list', async () => {
      followRepository.find.mockResolvedValue([]);
      const rsvpUserIds = Array.from({ length: 1500 }, (_, i) => `rsvp-${i}`);

      await listener.onStreamReminder({
        streamId: 's1',
        userId: 'creator-1',
        title: 'Going live',
        rsvpUserIds,
      });

      const [recipients] = pushDispatch.enqueueForUsers.mock.calls[0];
      expect(recipients.length).toBe(1000);
    });
  });
});
