import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { KpiService } from './kpi.service';

describe('KpiService', () => {
  let service: KpiService;
  let queryMock: jest.Mock;
  const prevLms = process.env.FEATURES_SKILL_ECONOMY_LMS;

  beforeEach(async () => {
    // Existing KPI math is LMS-shaped; YouTube-mode paths are covered separately below.
    process.env.FEATURES_SKILL_ECONOMY_LMS = 'true';
    queryMock = jest.fn();
    const mockDataSource = { query: queryMock };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KpiService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(KpiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (prevLms === undefined) delete process.env.FEATURES_SKILL_ECONOMY_LMS;
    else process.env.FEATURES_SKILL_ECONOMY_LMS = prevLms;
  });

  describe('computePlatformChurnRate', () => {
    it('returns zero churn when no prior period activity', async () => {
      queryMock
        .mockResolvedValueOnce([{ count: '0' }]) // prior active
        .mockResolvedValueOnce([{ count: '0' }]); // lapsed
      const result = await service.computePlatformChurnRate(30);
      expect(result.churnRate).toBe(0);
      expect(result.retentionRate).toBe(1);
      expect(result.windowDays).toBe(30);
    });

    it('computes churn and retention correctly', async () => {
      queryMock
        .mockResolvedValueOnce([{ count: '100' }]) // prior active
        .mockResolvedValueOnce([{ count: '20' }]);  // lapsed
      const result = await service.computePlatformChurnRate(30);
      expect(result.activeUsersInPriorPeriod).toBe(100);
      expect(result.lapsedUsers).toBe(20);
      expect(result.churnRate).toBe(0.2);
      expect(result.retainedUsers).toBe(80);
      expect(result.retentionRate).toBe(0.8);
    });
  });

  describe('computeUserEngagementScore', () => {
    it('returns inactive label and zero score when no activity', async () => {
      queryMock
        .mockResolvedValueOnce([{ total: '0', days: '0' }]) // xp
        .mockResolvedValueOnce([])                           // platform_xp row
        .mockResolvedValueOnce([{ count: '0' }])             // video views
        .mockResolvedValueOnce([{ count: '0' }]);            // lessons
      const result = await service.computeUserEngagementScore('u1');
      expect(result.score).toBe(0);
      expect(result.label).toBe('inactive');
    });

    it('computes high engagement for active user', async () => {
      queryMock
        .mockResolvedValueOnce([{ total: '200', days: '25' }]) // xp
        .mockResolvedValueOnce([{ streak: '20', longest_streak: '20' }]) // platform row
        .mockResolvedValueOnce([{ count: '15' }]) // video views
        .mockResolvedValueOnce([{ count: '8' }]); // lessons
      const result = await service.computeUserEngagementScore('u1');
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.label).toBe('high');
    });

    it('caps each score component at its max', async () => {
      queryMock
        .mockResolvedValueOnce([{ total: '10000', days: '30' }]) // huge XP
        .mockResolvedValueOnce([{ streak: '999', longest_streak: '999' }])
        .mockResolvedValueOnce([{ count: '1000' }]) // 1000 video views
        .mockResolvedValueOnce([{ count: '100' }]); // 100 lessons
      const result = await service.computeUserEngagementScore('u1');
      expect(result.score).toBe(100); // capped at 40+20+20+20
      expect(result.breakdown.xpActivity).toBe(40);
      expect(result.breakdown.streakBonus).toBe(20);
      expect(result.breakdown.videoActivity).toBe(20);
      expect(result.breakdown.lessonActivity).toBe(20);
    });
  });

  describe('computeCommunityChurnKpi', () => {
    it('computes community growth and engagement rates', async () => {
      queryMock
        .mockResolvedValueOnce([{ count: '200' }]) // total members
        .mockResolvedValueOnce([{ count: '20' }])  // new members
        .mockResolvedValueOnce([{ count: '60' }]); // engaged
      const result = await service.computeCommunityChurnKpi('comm-1', 30);
      expect(result.totalMembers).toBe(200);
      expect(result.newMembers).toBe(20);
      expect(result.growthRate).toBe(0.1);
      expect(result.activeEngaged).toBe(60);
      expect(result.engagementRate).toBe(0.3);
    });

    it('handles zero member community gracefully', async () => {
      queryMock
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }]);
      const result = await service.computeCommunityChurnKpi('empty-comm', 30);
      expect(result.growthRate).toBe(0);
      expect(result.engagementRate).toBe(0);
    });
  });

  describe('YouTube mode (LMS off)', () => {
    beforeEach(() => {
      delete process.env.FEATURES_SKILL_ECONOMY_LMS;
    });

    it('scores engagement from watch + comments without XP', async () => {
      queryMock
        .mockResolvedValueOnce([{ count: '10' }]) // video views
        .mockResolvedValueOnce([{ count: '10' }]); // comments
      const result = await service.computeUserEngagementScore('u1');
      expect(result.breakdown.xpActivity).toBe(0);
      expect(result.breakdown.streakBonus).toBe(0);
      expect(result.score).toBe(100);
      expect(result.label).toBe('high');
    });
  });
});
