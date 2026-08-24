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
  const pushDispatch = { enqueueForUsers: jest.fn().mockResolvedValue(undefined), enqueueForUser: jest.fn().mockResolvedValue(undefined) };
  const engagementService = { getBlockedPeerIds: jest.fn().mockResolvedValue([]) };
  const followRepository = { find: jest.fn() };
  const notificationsService = { create: jest.fn() };
  const mailService = { sendMail: jest.fn().mockResolvedValue(undefined) };
  const userRepository = { findOne: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    engagementService.getBlockedPeerIds.mockResolvedValue([]);
    userRepository.findOne.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsListener,
        { provide: NotificationsService, useValue: notificationsService },
        { provide: PushDispatchService, useValue: pushDispatch },
        { provide: MailService, useValue: mailService },
        { provide: EntitlementsService, useValue: {} },
        { provide: PremiumContentNotifyService, useValue: {} },
        { provide: EngagementService, useValue: engagementService },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(Follow), useValue: followRepository },
        { provide: getRepositoryToken(Comment), useValue: {} },
        { provide: getRepositoryToken(WatchHistory), useValue: {} },
        { provide: 'default_IORedisModuleConnectionToken', useValue: {} },
      ],
    }).compile();

    listener = module.get(NotificationsListener);
  });

  describe('maybeEmailUser (via onVideoReady)', () => {
    it('sends the transactional email when the user has not muted that category', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'u1',
        email: 'u1@example.com',
        notificationPreferences: null,
      });

      await listener.onVideoReady({ videoId: 'v1', userId: 'u1' });

      expect(mailService.sendMail).toHaveBeenCalledWith(
        'u1@example.com',
        expect.any(String),
        expect.any(String),
      );
    });

    it('does not send the transactional email when the user has muted that category', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'u1',
        email: 'u1@example.com',
        notificationPreferences: { mutedCategories: ['content'], emailDigest: false },
      });

      await listener.onVideoReady({ videoId: 'v1', userId: 'u1' });

      expect(mailService.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('copyright and strike notifications', () => {
    beforeEach(() => {
      userRepository.findOne.mockResolvedValue({
        id: 'u1',
        email: 'u1@example.com',
        notificationPreferences: null,
      });
    });

    it('notifies and emails the uploader when their video is taken down', async () => {
      await listener.onCopyrightTakedown({ videoId: 'v1', userId: 'u1', noticeId: 'n1' });

      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', metadata: { videoId: 'v1', noticeId: 'n1' } }),
      );
      expect(pushDispatch.enqueueForUser).toHaveBeenCalledWith('u1', expect.any(Object));
      expect(mailService.sendMail).toHaveBeenCalled();
    });

    it('notifies the uploader when their video is reinstated (no email)', async () => {
      await listener.onCopyrightVideoReinstated({ videoId: 'v1', userId: 'u1', noticeId: 'n1' });

      expect(notificationsService.create).toHaveBeenCalled();
      expect(mailService.sendMail).not.toHaveBeenCalled();
    });

    it('notifies and emails the user when a strike is issued, with consequence-specific wording', async () => {
      await listener.onStrikeIssued({
        userId: 'u1',
        strikeId: 's1',
        type: 'copyright',
        strikeNumber: 3,
        consequence: 'termination_recommended',
      });

      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          body: expect.stringContaining('termination'),
        }),
      );
      expect(mailService.sendMail).toHaveBeenCalled();
    });

    it('notifies the user when a strike is rescinded', async () => {
      await listener.onStrikeRescinded({ userId: 'u1', strikeId: 's1', reason: 'Notice withdrawn' });

      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', body: 'Notice withdrawn' }),
      );
    });

    it('notifies the user when their strike appeal is granted', async () => {
      await listener.onStrikeAppealResolved({ userId: 'u1', strikeId: 's1', granted: true });

      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', title: expect.stringContaining('granted') }),
      );
    });

    it('notifies the user when their strike appeal is denied', async () => {
      await listener.onStrikeAppealResolved({ userId: 'u1', strikeId: 's1', granted: false });

      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', title: expect.stringContaining('denied') }),
      );
    });
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
