import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Not } from 'typeorm';
import { CommunityActivityNotifyListener } from './community-activity-notify.listener';
import { CommunityMember, CommunityMemberStatus } from './entities/community-member.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

describe('CommunityActivityNotifyListener', () => {
  let listener: CommunityActivityNotifyListener;
  const notificationsService = { createMany: jest.fn().mockResolvedValue(undefined) };
  const memberRepository = { find: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityActivityNotifyListener,
        { provide: NotificationsService, useValue: notificationsService },
        { provide: getRepositoryToken(CommunityMember), useValue: memberRepository },
      ],
    }).compile();
    listener = moduleRef.get(CommunityActivityNotifyListener);
  });

  it('fans out a new-event notification to active members and excludes the creator', async () => {
    memberRepository.find.mockResolvedValueOnce([
      { id: 'm1', userId: 'u1' },
      { id: 'm2', userId: 'u2' },
    ]);

    await listener.onEventCreated({ communityId: 'c1', eventId: 'e1', creatorId: 'creator-1' });

    expect(memberRepository.find).toHaveBeenCalledTimes(1);
    const findArg = memberRepository.find.mock.calls[0][0];
    expect(findArg.where).toMatchObject({
      communityId: 'c1',
      status: CommunityMemberStatus.ACTIVE,
      userId: Not('creator-1'),
    });

    expect(notificationsService.createMany).toHaveBeenCalledTimes(1);
    const payload = notificationsService.createMany.mock.calls[0][0];
    expect(payload).toHaveLength(2);
    expect(payload[0]).toMatchObject({
      userId: 'u1',
      type: NotificationType.COMMUNITY_POST_NEW,
      title: 'New community event',
      metadata: { communityId: 'c1', eventId: 'e1', kind: 'event' },
    });
  });

  it('paginates through all member pages until a partial page is returned', async () => {
    const fullPage = Array.from({ length: 1000 }, (_, i) => ({ id: `m${i}`, userId: `u${i}` }));
    memberRepository.find
      .mockResolvedValueOnce(fullPage)
      .mockResolvedValueOnce([{ id: 'last', userId: 'last-user' }]);

    await listener.onEventCreated({ communityId: 'c1', eventId: 'e1' });

    expect(memberRepository.find).toHaveBeenCalledTimes(2);
    expect(memberRepository.find.mock.calls[1][0].skip).toBe(1000);
    expect(notificationsService.createMany).toHaveBeenCalledTimes(2);
  });

  it('does not query when there are no members', async () => {
    memberRepository.find.mockResolvedValueOnce([]);

    await listener.onEventCreated({ communityId: 'c1', eventId: 'e1' });

    expect(notificationsService.createMany).not.toHaveBeenCalled();
  });

  it('omits the userId exclusion filter when no creator is supplied', async () => {
    memberRepository.find.mockResolvedValueOnce([]);

    await listener.onEventCreated({ communityId: 'c1', eventId: 'e1' });

    expect(memberRepository.find.mock.calls[0][0].where).not.toHaveProperty('userId');
  });

  it('swallows repository errors without throwing', async () => {
    memberRepository.find.mockRejectedValueOnce(new Error('db down'));

    await expect(
      listener.onEventCreated({ communityId: 'c1', eventId: 'e1' }),
    ).resolves.toBeUndefined();
    expect(notificationsService.createMany).not.toHaveBeenCalled();
  });

  it('no longer reacts to per-message room activity (spam guard)', () => {
    expect((listener as unknown as Record<string, unknown>).onRoomMessage).toBeUndefined();
    expect((listener as unknown as Record<string, unknown>).onPostCreated).toBeUndefined();
  });
});
