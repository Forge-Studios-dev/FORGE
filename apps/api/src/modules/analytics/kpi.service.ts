import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { isSkillEconomyLmsEnabled } from '../../common/features/skill-economy-lms';

export interface PlatformChurnKpi {
  windowDays: number;
  activeUsersInPriorPeriod: number;
  lapsedUsers: number;
  churnRate: number;
  retainedUsers: number;
  retentionRate: number;
  computedAt: string;
}

export interface EngagementScoreKpi {
  userId: string;
  score: number;
  breakdown: {
    xpActivity: number;
    streakBonus: number;
    videoActivity: number;
    lessonActivity: number;
  };
  label: 'high' | 'medium' | 'low' | 'inactive';
  computedAt: string;
}

export interface CommunityChurnKpi {
  communityId: string;
  windowDays: number;
  totalMembers: number;
  newMembers: number;
  growthRate: number;
  activeEngaged: number;
  engagementRate: number;
  computedAt: string;
}

export interface PlatformKpiDashboard {
  churn: PlatformChurnKpi;
  topEngaged: EngagementScoreKpi[];
  computedAt: string;
}

@Injectable()
export class KpiService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Platform churn rate: users active in prior window but absent in current window.
   * LMS: platform_xp_grants. YouTube mode: watch.progress analytics events.
   */
  async computePlatformChurnRate(windowDays = 30): Promise<PlatformChurnKpi> {
    const now = new Date();
    const currentStart = new Date(now.getTime() - windowDays * 86_400_000);
    const priorStart = new Date(now.getTime() - 2 * windowDays * 86_400_000);
    const lmsOn = isSkillEconomyLmsEnabled();
    const source = lmsOn
      ? `platform_xp_grants`
      : `analytics_events`;
    const extra = lmsOn ? '' : ` AND event_name = 'watch.progress'`;

    const [priorResult, lapsedResult] = await Promise.all([
      this.dataSource.query<Array<{ count: string }>>(
        `SELECT COUNT(DISTINCT user_id) AS count FROM ${source}
         WHERE created_at >= $1 AND created_at < $2${extra}`,
        [priorStart, currentStart],
      ),
      this.dataSource.query<Array<{ count: string }>>(
        `SELECT COUNT(DISTINCT user_id) AS count FROM ${source}
         WHERE created_at >= $1 AND created_at < $2${extra}
           AND user_id NOT IN (
             SELECT DISTINCT user_id FROM ${source}
             WHERE created_at >= $2${extra}
           )`,
        [priorStart, currentStart],
      ),
    ]);

    const priorActive = parseInt(priorResult[0]?.count ?? '0', 10);
    const lapsed = parseInt(lapsedResult[0]?.count ?? '0', 10);
    const retained = priorActive - lapsed;
    const churnRate = priorActive > 0 ? lapsed / priorActive : 0;
    const retentionRate = priorActive > 0 ? retained / priorActive : 1;

    return {
      windowDays,
      activeUsersInPriorPeriod: priorActive,
      lapsedUsers: lapsed,
      churnRate: Math.round(churnRate * 1000) / 1000,
      retainedUsers: retained,
      retentionRate: Math.round(retentionRate * 1000) / 1000,
      computedAt: now.toISOString(),
    };
  }

  /** Compute engagement score (0–100) for a single user based on last 30 days of activity. */
  async computeUserEngagementScore(userId: string): Promise<EngagementScoreKpi> {
    const since = new Date(Date.now() - 30 * 86_400_000);

    if (!isSkillEconomyLmsEnabled()) {
      const [videoViews, comments] = await Promise.all([
        this.dataSource.query<Array<{ count: string }>>(
          `SELECT COUNT(*) AS count FROM analytics_events
           WHERE user_id = $1 AND event_name = 'watch.progress' AND created_at >= $2`,
          [userId, since],
        ),
        this.dataSource.query<Array<{ count: string }>>(
          `SELECT COUNT(*) AS count FROM comments
           WHERE user_id = $1 AND created_at >= $2 AND deleted_at IS NULL`,
          [userId, since],
        ),
      ]);
      const videoCount = parseInt(videoViews[0]?.count ?? '0', 10);
      const commentCount = parseInt(comments[0]?.count ?? '0', 10);
      const videoScore = Math.min(70, Math.round((videoCount / 10) * 70));
      const commentScore = Math.min(30, Math.round((commentCount / 10) * 30));
      const score = videoScore + commentScore;
      const label: EngagementScoreKpi['label'] =
        score >= 70 ? 'high' : score >= 40 ? 'medium' : score >= 10 ? 'low' : 'inactive';
      return {
        userId,
        score,
        breakdown: {
          xpActivity: 0,
          streakBonus: 0,
          videoActivity: videoScore,
          lessonActivity: commentScore,
        },
        label,
        computedAt: new Date().toISOString(),
      };
    }

    const [xpActivity, platformRow, videoViews, lessonCompletions] = await Promise.all([
      this.dataSource.query<Array<{ total: string; days: string }>>(
        `SELECT COALESCE(SUM(xp_awarded), 0) AS total,
                COUNT(DISTINCT granted_date) AS days
         FROM platform_xp_grants
         WHERE user_id = $1 AND created_at >= $2`,
        [userId, since],
      ),
      this.dataSource.query<Array<{ streak: string; longest_streak: string }>>(
        `SELECT COALESCE(streak, 0) AS streak,
                COALESCE(longest_streak, 0) AS longest_streak
         FROM platform_xp WHERE user_id = $1`,
        [userId],
      ),
      this.dataSource.query<Array<{ count: string }>>(
        `SELECT COUNT(*) AS count FROM analytics_events
         WHERE user_id = $1 AND event_name = 'watch.progress' AND created_at >= $2`,
        [userId, since],
      ),
      this.dataSource.query<Array<{ count: string }>>(
        `SELECT COUNT(*) AS count FROM platform_xp_grants
         WHERE user_id = $1 AND action_type = 'lesson_complete' AND created_at >= $2`,
        [userId, since],
      ),
    ]);

    const totalXp = parseInt(xpActivity[0]?.total ?? '0', 10);
    const streak = parseInt(platformRow[0]?.streak ?? '0', 10);
    const videoCount = parseInt(videoViews[0]?.count ?? '0', 10);
    const lessonCount = parseInt(lessonCompletions[0]?.count ?? '0', 10);

    // Score components (max 100):
    // XP activity: 0-40 pts (200 XP = 40 pts, capped)
    const xpScore = Math.min(40, Math.round((totalXp / 200) * 40));
    // Streak: 0-20 pts (30-day streak = 20 pts)
    const streakScore = Math.min(20, Math.round((streak / 30) * 20));
    // Video activity: 0-20 pts (10 views = 20 pts)
    const videoScore = Math.min(20, Math.round((videoCount / 10) * 20));
    // Lesson completions: 0-20 pts (5 lessons = 20 pts)
    const lessonScore = Math.min(20, Math.round((lessonCount / 5) * 20));

    const score = xpScore + streakScore + videoScore + lessonScore;
    const label: EngagementScoreKpi['label'] =
      score >= 70 ? 'high' : score >= 40 ? 'medium' : score >= 10 ? 'low' : 'inactive';

    return {
      userId,
      score,
      breakdown: { xpActivity: xpScore, streakBonus: streakScore, videoActivity: videoScore, lessonActivity: lessonScore },
      label,
      computedAt: new Date().toISOString(),
    };
  }

  /**
   * Community-level churn approximation: growth rate + engagement rate.
   * Requires community_members and community_room_messages tables.
   */
  async computeCommunityChurnKpi(communityId: string, windowDays = 30): Promise<CommunityChurnKpi> {
    const since = new Date(Date.now() - windowDays * 86_400_000);

    const [totalResult, newResult, engagedResult] = await Promise.all([
      this.dataSource.query<Array<{ count: string }>>(
        `SELECT COUNT(*) AS count FROM community_members
         WHERE community_id = $1 AND status = 'active'`,
        [communityId],
      ),
      this.dataSource.query<Array<{ count: string }>>(
        `SELECT COUNT(*) AS count FROM community_members
         WHERE community_id = $1 AND status = 'active' AND joined_at >= $2`,
        [communityId, since],
      ),
      this.dataSource.query<Array<{ count: string }>>(
        `SELECT COUNT(DISTINCT user_id) AS count FROM community_room_messages
         WHERE community_id = $1 AND created_at >= $2`,
        [communityId, since],
      ),
    ]);

    const total = parseInt(totalResult[0]?.count ?? '0', 10);
    const newMembers = parseInt(newResult[0]?.count ?? '0', 10);
    const engaged = parseInt(engagedResult[0]?.count ?? '0', 10);
    const growthRate = total > 0 ? newMembers / total : 0;
    const engagementRate = total > 0 ? engaged / total : 0;

    return {
      communityId,
      windowDays,
      totalMembers: total,
      newMembers,
      growthRate: Math.round(growthRate * 1000) / 1000,
      activeEngaged: engaged,
      engagementRate: Math.round(engagementRate * 1000) / 1000,
      computedAt: new Date().toISOString(),
    };
  }

  /**
   * P12-T024: Churn prediction — identify at-risk community members.
   * Members inactive for > windowDays with < threshold XP activity flagged as at-risk.
   */
  async predictCommunityChurn(
    communityId: string,
    windowDays = 30,
  ): Promise<{
    communityId: string;
    windowDays: number;
    atRiskCount: number;
    atRiskMembers: Array<{ userId: string; daysSinceActivity: number; riskScore: number }>;
    computedAt: string;
  }> {
    const since = new Date(Date.now() - windowDays * 86_400_000);

    const activitySql = isSkillEconomyLmsEnabled()
      ? `SELECT cm.user_id,
              MAX(xp.created_at) AS last_activity,
              COUNT(xp.id) AS activity_count
         FROM community_members cm
         LEFT JOIN platform_xp_grants xp
                ON xp.user_id = cm.user_id AND xp.created_at >= $2
         WHERE cm.community_id = $1
           AND cm.status = 'active'
         GROUP BY cm.user_id`
      : `SELECT cm.user_id,
              MAX(act.created_at) AS last_activity,
              COUNT(act.created_at) AS activity_count
         FROM community_members cm
         LEFT JOIN (
           SELECT m.user_id, m.created_at
           FROM community_room_messages m
           INNER JOIN community_rooms r ON r.id = m.room_id
           WHERE r.community_id = $1 AND m.created_at >= $2 AND m.deleted_at IS NULL
           UNION ALL
           SELECT p.author_id AS user_id, p.created_at
           FROM community_posts p
           WHERE p.community_id = $1 AND p.created_at >= $2
         ) act ON act.user_id = cm.user_id
         WHERE cm.community_id = $1
           AND cm.status = 'active'
         GROUP BY cm.user_id`;

    const rows = await this.dataSource.query<
      Array<{ user_id: string; last_activity: string | null; activity_count: string }>
    >(activitySql, [communityId, since]);

    const now = Date.now();
    const atRisk = rows
      .map((r) => {
        const lastMs = r.last_activity ? new Date(r.last_activity).getTime() : 0;
        const daysSince = Math.floor((now - lastMs) / 86_400_000);
        const activityCount = parseInt(r.activity_count, 10);
        const riskScore = Math.min(
          100,
          Math.round((daysSince / windowDays) * 70 + (activityCount === 0 ? 30 : 0)),
        );
        return { userId: r.user_id, daysSinceActivity: daysSince, riskScore };
      })
      .filter((m) => m.riskScore >= 60)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 50);

    return {
      communityId,
      windowDays,
      atRiskCount: atRisk.length,
      atRiskMembers: atRisk,
      computedAt: new Date().toISOString(),
    };
  }

  /**
   * P12-T023/P12-T025/P12-T026: Community health, engagement prediction & risk assessment.
   * Returns composite signals for the creator dashboard.
   */
  async communityPredictions(communityId: string): Promise<{
    communityId: string;
    healthScore: number;
    healthLabel: 'healthy' | 'stable' | 'needs_attention' | 'at_risk';
    engagementPrediction: { next7dEngagementRate: number; trend: 'up' | 'flat' | 'down' };
    riskAssessment: {
      riskLevel: 'low' | 'medium' | 'high';
      factors: string[];
    };
    computedAt: string;
  }> {
    const [kpi, churnPrediction] = await Promise.all([
      this.computeCommunityChurnKpi(communityId, 30),
      this.predictCommunityChurn(communityId, 30),
    ]);

    const kpi7 = await this.computeCommunityChurnKpi(communityId, 7);

    // Health score: weighted combination of growth, engagement, churn risk
    const atRiskRatio =
      kpi.totalMembers > 0 ? churnPrediction.atRiskCount / kpi.totalMembers : 0;
    const healthScore = Math.max(
      0,
      Math.round(
        kpi.engagementRate * 50 +
          Math.min(kpi.growthRate, 0.2) * 100 -
          atRiskRatio * 30,
      ),
    );

    const healthLabel =
      healthScore >= 70
        ? 'healthy'
        : healthScore >= 50
          ? 'stable'
          : healthScore >= 30
            ? 'needs_attention'
            : 'at_risk';

    // Engagement trend: compare 7d vs 30d
    const trend: 'up' | 'flat' | 'down' =
      kpi7.engagementRate > kpi.engagementRate * 1.05
        ? 'up'
        : kpi7.engagementRate < kpi.engagementRate * 0.95
          ? 'down'
          : 'flat';

    // Risk factors
    const factors: string[] = [];
    if (atRiskRatio > 0.2) factors.push('More than 20% of members inactive');
    if (kpi.growthRate < 0) factors.push('Declining member count');
    if (kpi.engagementRate < 0.1) factors.push('Low community engagement rate');
    if (trend === 'down') factors.push('Engagement trending down this week');

    const riskLevel: 'low' | 'medium' | 'high' =
      factors.length === 0 ? 'low' : factors.length <= 2 ? 'medium' : 'high';

    return {
      communityId,
      healthScore,
      healthLabel,
      engagementPrediction: {
        next7dEngagementRate: Math.round(kpi7.engagementRate * 1000) / 1000,
        trend,
      },
      riskAssessment: { riskLevel, factors },
      computedAt: new Date().toISOString(),
    };
  }

  /** Platform KPI dashboard: churn + top engaged users snapshot. */
  async platformDashboard(): Promise<PlatformKpiDashboard> {
    const churn = await this.computePlatformChurnRate(30);

    const topUsersResult = await this.dataSource.query<Array<{ user_id: string }>>(
      isSkillEconomyLmsEnabled()
        ? `SELECT user_id FROM platform_xp ORDER BY xp DESC LIMIT 10`
        : `SELECT user_id FROM analytics_events
           WHERE event_name = 'watch.progress' AND created_at >= NOW() - INTERVAL '30 days'
             AND user_id IS NOT NULL
           GROUP BY user_id ORDER BY COUNT(*) DESC LIMIT 10`,
    );
    const topEngaged = await Promise.all(
      topUsersResult.map((r) => this.computeUserEngagementScore(r.user_id)),
    );

    return { churn, topEngaged, computedAt: new Date().toISOString() };
  }
}
