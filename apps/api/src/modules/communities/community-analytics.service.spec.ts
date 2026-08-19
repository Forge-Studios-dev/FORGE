import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CommunityAnalyticsService } from './community-analytics.service';
import { Community } from './entities/community.entity';
import { Channel } from './entities/channel.entity';
import { CommunityModerationService } from './community-moderation.service';
import { CommunityAccessService } from './community-access.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

describe('CommunityAnalyticsService', () => {
  let service: CommunityAnalyticsService;

  const communityRepository = { find: jest.fn().mockResolvedValue([]) };
  const channelRepository = { count: jest.fn().mockResolvedValue(3) };
  const entitlementsService = {
    getSubscriberAnalytics: jest
      .fn()
      .mockResolvedValue({ active: 10, trial: 2, canceled: 1, mrrCents: 50000 }),
  };
  const moderationService = {};
  const accessService = {
    assertCommunityPermission: jest
      .fn()
      .mockResolvedValue({ id: 'community-1', creatorId: 'creator-1' }),
  };

  /** Matches each raw SQL call by a distinguishing table/column fragment rather than call order. */
  function makeDataSourceMock(counts: Record<string, number>, trendRows: Record<string, Array<{ day: string; count: string }>> = {}) {
    return {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM community_members') && sql.includes("date_trunc")) {
          return trendRows.newMembers ?? [];
        }
        if (sql.includes('FROM community_members') && sql.includes('joined_at >=')) {
          return [{ count: String(counts.newMembers ?? 0) }];
        }
        if (sql.includes('FROM community_members')) {
          return [{ count: String(counts.totalMembers ?? 0) }];
        }
        if (sql.includes('FROM channel_messages') && sql.includes('date_trunc')) {
          return trendRows.messages ?? [];
        }
        if (sql.includes('FROM channel_messages') && sql.includes('COUNT(DISTINCT')) {
          return [{ count: String(counts.active ?? 0) }];
        }
        if (sql.includes('FROM channel_messages')) {
          return [{ count: String(counts.messages ?? 0) }];
        }
        if (sql.includes('FROM community_room_messages')) {
          return [{ count: String(counts.roomMessages ?? 0) }];
        }
        if (sql.includes('FROM community_posts') && sql.includes('date_trunc')) {
          return trendRows.posts ?? [];
        }
        if (sql.includes('FROM community_posts')) {
          return [{ count: String(counts.posts ?? 0) }];
        }
        if (sql.includes('FROM community_poll_votes')) {
          return [{ count: String(counts.pollVotes ?? 0) }];
        }
        if (sql.includes('FROM member_subscriptions') && sql.includes("IN ('active'")) {
          return [{ count: String(counts.activeSubs ?? 0) }];
        }
        if (sql.includes('member_subscriptions') || sql.includes('member_xp')) {
          return [{ count: '0' }];
        }
        return [];
      }),
    };
  }

  async function setupService(dataSource: unknown) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityAnalyticsService,
        { provide: getRepositoryToken(Community), useValue: communityRepository },
        { provide: getRepositoryToken(Channel), useValue: channelRepository },
        { provide: EntitlementsService, useValue: entitlementsService },
        { provide: CommunityModerationService, useValue: moderationService },
        { provide: CommunityAccessService, useValue: accessService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    return module.get(CommunityAnalyticsService);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports new-member growth counts and daily trend alongside existing engagement metrics', async () => {
    const dataSource = makeDataSourceMock(
      { newMembers: 4, totalMembers: 42, messages: 10, roomMessages: 2, active: 5, posts: 3, pollVotes: 1 },
      { newMembers: [{ day: '2026-08-15', count: '4' }] },
    );
    service = await setupService(dataSource);

    const result = await service.getCommunityAnalytics('actor-1', 'community-1');

    expect(result.newMembersLast7Days).toBe(4);
    expect(result.totalMembers).toBe(42);
    expect(result.trends.dailyNewMembers).toEqual([{ date: '2026-08-15', count: 4 }]);
    // pre-existing metrics stay intact
    expect(result.messagesLast7Days).toBe(12);
    expect(result.activeMembersLast7Days).toBe(5);
  });

  it('defaults new-member counts to zero when no joins occurred in the window', async () => {
    const dataSource = makeDataSourceMock({});
    service = await setupService(dataSource);

    const result = await service.getCommunityAnalytics('actor-1', 'community-1');

    expect(result.newMembersLast7Days).toBe(0);
    expect(result.totalMembers).toBe(0);
    expect(result.trends.dailyNewMembers).toEqual([]);
  });

  it('only counts active members, matching the accepted-membership status filter', async () => {
    const dataSource = makeDataSourceMock({ newMembers: 1, totalMembers: 1 });
    service = await setupService(dataSource);
    await service.getCommunityAnalytics('actor-1', 'community-1');

    const calls = (dataSource.query as jest.Mock).mock.calls;
    const memberCountCalls = calls.filter(([sql]: [string]) => sql.includes('FROM community_members'));
    expect(memberCountCalls.length).toBeGreaterThan(0);
    for (const [sql] of memberCountCalls) {
      expect(sql).toContain("status = 'active'");
    }
  });

  describe('getCreatorBusinessAnalytics — live revenue', () => {
    function makeRevenueDataSourceMock(ticketCents: number, superChatCents: number) {
      return {
        query: jest.fn(async (sql: string) => {
          if (sql.includes('FROM stream_event_purchases')) {
            return [{ total: String(ticketCents) }];
          }
          if (sql.includes('FROM stream_messages') && sql.includes("message_type = 'super_chat'")) {
            return [{ total: String(superChatCents) }];
          }
          return [];
        }),
      };
    }

    it('includes super chat revenue alongside ticket revenue in live revenue totals (was ticket-only)', async () => {
      const dataSource = makeRevenueDataSourceMock(9_000, 3_000);
      service = await setupService(dataSource);

      const result = await service.getCreatorBusinessAnalytics('creator-1');

      expect(result.revenue.liveTickets30d).toBe(9_000);
      expect(result.revenue.superChat30d).toBe(3_000);
      expect(result.revenue.liveEvents30d).toBe(12_000);
      expect(result.membership.totalRevenue30d).toBe(12_000);
    });

    it('excludes refunded/disputed super chats from the revenue total via the SQL predicate', async () => {
      const dataSource = makeRevenueDataSourceMock(0, 0);
      service = await setupService(dataSource);
      await service.getCreatorBusinessAnalytics('creator-1');

      const calls = (dataSource.query as jest.Mock).mock.calls;
      const [superChatSql] = calls.find(([sql]: [string]) => sql.includes('FROM stream_messages'))!;
      expect(superChatSql).toContain('refunded_at IS NULL');
      expect(superChatSql).toContain('creator_net_cents');
    });
  });
});
