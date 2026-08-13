import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { toCsv } from '../../common/utils/csv.util';
import { isSkillEconomyLmsEnabled } from '../../common/features/skill-economy-lms';
import { Community } from './entities/community.entity';
import { Channel } from './entities/channel.entity';
import { CommunityModerationService } from './community-moderation.service';
import { CommunityAccessService } from './community-access.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { UserRole } from '../users/entities/user.entity';

/**
 * Community + creator analytics and CSV export paths.
 *
 * Extracted from CommunitiesService (C2 in FRESH_AUDIT_2026-07-26 — god-object
 * split). Behavior is unchanged; CommunitiesService remains a public facade
 * that forwards to this service so external callers do not have to migrate.
 */
@Injectable()
export class CommunityAnalyticsService {
  constructor(
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
    private readonly entitlementsService: EntitlementsService,
    @Inject(forwardRef(() => CommunityModerationService))
    private readonly moderationService: CommunityModerationService,
    @Inject(forwardRef(() => CommunityAccessService))
    private readonly accessService: CommunityAccessService,
    private readonly dataSource: DataSource,
  ) {}

  async getCommunityAnalytics(actorId: string, communityId: string, viewerRole?: UserRole | null) {
    const community = await this.accessService.assertCommunityPermission(
      actorId,
      communityId,
      'view_analytics',
      viewerRole,
    );

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [messagesRow, roomMessagesRow] = await Promise.all([
      this.dataSource.query<{ count: string }[]>(
        `SELECT COUNT(*)::int AS count
         FROM channel_messages m
         INNER JOIN channels ch ON ch.id = m.channel_id
         WHERE ch.community_id = $1 AND m.created_at >= $2 AND m.deleted_at IS NULL`,
        [communityId, since],
      ),
      this.dataSource.query<{ count: string }[]>(
        `SELECT COUNT(*)::int AS count
         FROM community_room_messages m
         INNER JOIN community_rooms r ON r.id = m.room_id
         WHERE r.community_id = $1 AND m.created_at >= $2 AND m.deleted_at IS NULL`,
        [communityId, since],
      ),
    ]);

    const [activeRow] = await this.dataSource.query<{ count: string }[]>(
      `SELECT COUNT(DISTINCT m.user_id)::int AS count
       FROM channel_messages m
       INNER JOIN channels ch ON ch.id = m.channel_id
       WHERE ch.community_id = $1 AND m.created_at >= $2 AND m.deleted_at IS NULL`,
      [communityId, since],
    );

    const [postsRow] = await this.dataSource.query<{ count: string }[]>(
      `SELECT COUNT(*)::int AS count FROM community_posts
       WHERE community_id = $1 AND created_at >= $2`,
      [communityId, since],
    );

    const [pollVotesRow] = await this.dataSource.query<{ count: string }[]>(
      `SELECT COUNT(*)::int AS count
       FROM community_poll_votes v
       INNER JOIN community_polls p ON p.id = v.poll_id
       WHERE p.community_id = $1 AND v.created_at >= $2`,
      [communityId, since],
    );

    const channelCount = await this.channelRepository.count({ where: { communityId } });
    const trends = await this.getCommunityDailyTrends(communityId, since);

    return {
      communityId,
      periodDays: 7,
      messagesLast7Days:
        Number(messagesRow?.[0]?.count ?? 0) + Number(roomMessagesRow?.[0]?.count ?? 0),
      channelMessagesLast7Days: Number(messagesRow?.[0]?.count ?? 0),
      roomMessagesLast7Days: Number(roomMessagesRow?.[0]?.count ?? 0),
      activeMembersLast7Days: Number(activeRow?.count ?? 0),
      postsLast7Days: Number(postsRow?.count ?? 0),
      pollVotesLast7Days: Number(pollVotesRow?.count ?? 0),
      channelCount,
      retention: await this.getCommunityRetentionMetrics(community.creatorId, communityId),
      trends,
    };
  }

  private async getCommunityDailyTrends(communityId: string, since: Date) {
    const messageRows = await this.dataSource.query<{ day: string; count: string }[]>(
      `SELECT to_char(date_trunc('day', m.created_at), 'YYYY-MM-DD') AS day,
              COUNT(*)::int AS count
       FROM channel_messages m
       INNER JOIN channels ch ON ch.id = m.channel_id
       WHERE ch.community_id = $1 AND m.created_at >= $2 AND m.deleted_at IS NULL
       GROUP BY 1 ORDER BY 1`,
      [communityId, since],
    );
    const postRows = await this.dataSource.query<{ day: string; count: string }[]>(
      `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
              COUNT(*)::int AS count
       FROM community_posts
       WHERE community_id = $1 AND created_at >= $2
       GROUP BY 1 ORDER BY 1`,
      [communityId, since],
    );
    return {
      dailyMessages: messageRows.map((r) => ({ date: r.day, count: Number(r.count) })),
      dailyPosts: postRows.map((r) => ({ date: r.day, count: Number(r.count) })),
    };
  }

  async getCreatorBusinessAnalytics(creatorId: string) {
    const periodDays = 30;
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    const lmsEnabled = isSkillEconomyLmsEnabled();
    const membership = await this.entitlementsService.getSubscriberAnalytics(creatorId);

    const communities = await this.communityRepository.find({
      where: { creatorId },
      order: { createdAt: 'ASC' },
    });
    const communityIds = communities.map((c) => c.id);

    let engagedMembers = 0;
    let activeChatters = 0;
    let postAuthors = 0;

    if (communityIds.length > 0) {
      const chatQuery = this.dataSource.query<{ count: string }[]>(
        `SELECT COUNT(DISTINCT user_id)::int AS count FROM (
           SELECT m.user_id
           FROM channel_messages m
           INNER JOIN channels ch ON ch.id = m.channel_id
           WHERE ch.community_id = ANY($1::uuid[]) AND m.created_at >= $2 AND m.deleted_at IS NULL
           UNION
           SELECT m.user_id
           FROM community_room_messages m
           INNER JOIN community_rooms r ON r.id = m.room_id
           WHERE r.community_id = ANY($1::uuid[]) AND m.created_at >= $2 AND m.deleted_at IS NULL
         ) chatters`,
        [communityIds, since],
      );
      const postsQuery = this.dataSource.query<{ count: string }[]>(
        `SELECT COUNT(DISTINCT author_id)::int AS count FROM community_posts
         WHERE community_id = ANY($1::uuid[]) AND created_at >= $2`,
        [communityIds, since],
      );

      if (lmsEnabled) {
        const [[engagedRow], [chatRow], [postAuthorRow]] = await Promise.all([
          this.dataSource.query<{ count: string }[]>(
            `SELECT COUNT(DISTINCT user_id)::int AS count FROM member_xp
             WHERE community_id = ANY($1::uuid[])`,
            [communityIds],
          ),
          chatQuery,
          postsQuery,
        ]);
        engagedMembers = Number(engagedRow?.count ?? 0);
        activeChatters = Number(chatRow?.count ?? 0);
        postAuthors = Number(postAuthorRow?.count ?? 0);
      } else {
        const [[chatRow], [postAuthorRow]] = await Promise.all([chatQuery, postsQuery]);
        activeChatters = Number(chatRow?.count ?? 0);
        postAuthors = Number(postAuthorRow?.count ?? 0);
      }
    }

    let courseEnrollments = 0;
    if (lmsEnabled) {
      const [courseEnrollRow] = await this.dataSource.query<{ count: string }[]>(
        `SELECT COUNT(DISTINCT e.user_id)::int AS count
         FROM course_enrollments e
         INNER JOIN courses c ON c.id = e.course_id
         WHERE c.creator_id = $1 AND e.enrolled_at >= $2`,
        [creatorId, since],
      );
      courseEnrollments = Number(courseEnrollRow?.count ?? 0);
    }

    const payingMembers = membership.active + membership.trial;
    const pct = (n: number) =>
      payingMembers > 0 ? Math.round((n / payingMembers) * 100) : 0;

    const funnel: Array<{
      stage: string;
      label: string;
      count: number;
      rateFromTop: number;
    }> = [
      {
        stage: 'paying_members',
        label: 'Paying members',
        count: payingMembers,
        rateFromTop: 100,
      },
    ];
    if (lmsEnabled) {
      funnel.push({
        stage: 'engaged_xp',
        label: 'Engaged (XP)',
        count: engagedMembers,
        rateFromTop: pct(engagedMembers),
      });
    }
    funnel.push(
      {
        stage: 'active_chat',
        label: 'Active in chat (30d)',
        count: activeChatters,
        rateFromTop: pct(activeChatters),
      },
      {
        stage: 'post_authors',
        label: 'Posted (30d)',
        count: postAuthors,
        rateFromTop: pct(postAuthors),
      },
    );
    if (lmsEnabled) {
      funnel.push({
        stage: 'course_enrolled',
        label: 'Course enrolled (30d)',
        count: courseEnrollments,
        rateFromTop: pct(courseEnrollments),
      });
    }

    const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeRows =
      communityIds.length === 0
        ? []
        : await this.dataSource.query<Array<{ community_id: string; count: string }>>(
            `SELECT community_id, COUNT(DISTINCT user_id)::int AS count FROM (
               SELECT ch.community_id, m.user_id
               FROM channel_messages m
               INNER JOIN channels ch ON ch.id = m.channel_id
               WHERE ch.community_id = ANY($1::uuid[]) AND m.created_at >= $2 AND m.deleted_at IS NULL
               UNION
               SELECT r.community_id, m.user_id
               FROM community_room_messages m
               INNER JOIN community_rooms r ON r.id = m.room_id
               WHERE r.community_id = ANY($1::uuid[]) AND m.created_at >= $2 AND m.deleted_at IS NULL
             ) active GROUP BY community_id`,
            [communityIds, since7],
          );
    const activeByCommunity = new Map(
      activeRows.map((r) => [r.community_id, Number(r.count ?? 0)]),
    );
    const communitySummaries = communities.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      activeMembersLast7Days: activeByCommunity.get(c.id) ?? 0,
    }));

    const cohortRetention = await this.getSubscriberCohortRetention(creatorId);

    // Churn rate: subscriptions canceled in the last 30 days vs. total
    // that were active at start of period (approximated as active+trial+canceled30d).
    const [canceledRow] = await this.dataSource.query<{ count: string }[]>(
      `SELECT COUNT(*)::int AS count FROM member_subscriptions
       WHERE creator_id = $1 AND status = 'canceled' AND updated_at >= $2`,
      [creatorId, since],
    );
    const canceledLast30Days = Number(canceledRow?.count ?? 0);
    const denominator = membership.active + membership.trial + canceledLast30Days;
    const churnRate30d = denominator > 0 ? Math.round((canceledLast30Days / denominator) * 10000) / 100 : 0;

    // Engagement score: weighted activity signals normalized to 0-100.
    // LMS: chat 40% + posts 30% + course enrollments 30%. YouTube: chat 55% + posts 45%.
    const totalMembers = membership.active + membership.trial;
    const engagementScore =
      totalMembers > 0
        ? Math.min(
            100,
            Math.round(
              (lmsEnabled
                ? activeChatters * 0.4 + postAuthors * 0.3 + courseEnrollments * 0.3
                : activeChatters * 0.55 + postAuthors * 0.45) /
                totalMembers *
                100,
            ),
          )
        : 0;

    // Live event revenue (30d) from paid stream tickets
    const [liveRevenueRow] = await this.dataSource.query<{ total: string | null }[]>(
      `SELECT COALESCE(SUM(sep.amount_cents), 0)::bigint AS total
       FROM stream_event_purchases sep
       INNER JOIN streams s ON s.id = sep.stream_id
       WHERE s.user_id = $1 AND sep.created_at >= $2 AND sep.status = 'completed' AND sep.grant_source = 'purchase'`,
      [creatorId, since],
    );
    const liveRevenue30dCents = Number(liveRevenueRow?.total ?? 0);

    return {
      periodDays,
      membership: {
        active: membership.active,
        trial: membership.trial,
        canceled: membership.canceled,
        mrrCents: membership.mrrCents,
        totalRevenue30d: liveRevenue30dCents,
      },
      revenue: {
        mrr: membership.mrrCents,
        arr: membership.mrrCents * 12,
        liveEvents30d: liveRevenue30dCents,
      },
      kpis: {
        churnRate30d,
        canceledLast30Days,
        engagementScore,
      },
      engagement: {
        engagedMembers,
        activeChatters,
        postAuthors,
        courseEnrollments,
      },
      funnel,
      cohortRetention,
      communities: communitySummaries,
    };
  }

  /**
   * Studio home "today" strip — merges the things a creator actually needs to
   * act on (unread comments, open moderation reports, failed-payment members)
   * into one severity-ranked list, mirroring the admin dashboard's attention
   * queue (apps/admin/src/app/dashboard/page.tsx) but scoped to one creatorId.
   * Deliberately excludes revenue/MRR — that's a KPI to *read*, not an item to
   * *act on*, and (unlike the three signals below) there's no historized
   * snapshot to compute a real period-over-period delta from yet.
   */
  async getCreatorAttention(creatorId: string) {
    const [commentRows, moderation, subscriberAnalytics, failedVideos, scheduledVideos] =
      await Promise.all([
      this.dataSource.query<
        Array<{
          id: string;
          video_id: string;
          video_title: string;
          content: string;
          created_at: string;
          total_count: string;
        }>
      >(
        `SELECT c.id, c.video_id, v.title AS video_title, c.content, c.created_at,
                COUNT(*) OVER()::int AS total_count
         FROM comments c
         INNER JOIN videos v ON v.id = c.video_id
         WHERE v.user_id = $1
           AND c.parent_id IS NULL
           AND c.deleted_at IS NULL
           AND c.user_id != $1
           AND NOT EXISTS (
             SELECT 1 FROM comments r
             WHERE r.parent_id = c.id AND r.user_id = $1 AND r.deleted_at IS NULL
           )
         ORDER BY c.created_at DESC
         LIMIT 5`,
        [creatorId],
      ),
      this.moderationService.listUnifiedReportsForCreator(creatorId, 'open'),
      this.entitlementsService.getSubscriberAnalytics(creatorId),
      this.dataSource.query<
        Array<{
          id: string;
          title: string;
          status: string;
          failure_reason: string | null;
          updated_at: string;
          total_count: string;
        }>
      >(
        `SELECT id, title, status, failure_reason, updated_at,
                COUNT(*) OVER()::int AS total_count
         FROM videos
         WHERE user_id = $1
           AND status = 'failed'
         ORDER BY updated_at DESC
         LIMIT 5`,
        [creatorId],
      ),
      this.dataSource.query<
        Array<{
          id: string;
          title: string;
          scheduled_publish_at: string;
          total_count: string;
        }>
      >(
        `SELECT id, title, scheduled_publish_at,
                COUNT(*) OVER()::int AS total_count
         FROM videos
         WHERE user_id = $1
           AND scheduled_publish_at IS NOT NULL
           AND scheduled_publish_at > NOW()
         ORDER BY scheduled_publish_at ASC
         LIMIT 5`,
        [creatorId],
      ),
    ]);

    const commentsNeedingReply = Number(commentRows[0]?.total_count ?? 0);
    const pendingModeration = moderation.data.length;
    const failedPayments = subscriberAnalytics.byStatus['failed_payment'] ?? 0;
    const processingFailures = Number(failedVideos[0]?.total_count ?? 0);
    const scheduledUpcoming = Number(scheduledVideos[0]?.total_count ?? 0);

    type AttentionItem = {
      id: string;
      kind: 'comment' | 'moderation' | 'billing' | 'processing' | 'scheduled';
      label: string;
      detail: string;
      href: string;
      tone: 'primary' | 'warning' | 'critical';
      createdAt: string;
    };

    const items: AttentionItem[] = [
      ...failedVideos.map(
        (v): AttentionItem => ({
          id: `processing-${v.id}`,
          kind: 'processing',
          label: `Processing failed: "${v.title}"`,
          detail: v.failure_reason?.trim() || 'Transcode failed — open the video to retry.',
          href: `/studio/videos/${v.id}`,
          tone: 'critical',
          createdAt: new Date(v.updated_at).toISOString(),
        }),
      ),
      ...commentRows.map(
        (c): AttentionItem => ({
          id: `comment-${c.id}`,
          kind: 'comment',
          label: `Comment on "${c.video_title}"`,
          detail: c.content.length > 80 ? `${c.content.slice(0, 80)}…` : c.content,
          href: `/watch/${c.video_id}?lc=${c.id}`,
          tone: 'primary',
          createdAt: c.created_at,
        }),
      ),
      ...moderation.data.slice(0, 5).map(
        (r): AttentionItem => ({
          id: `moderation-${r.id}`,
          kind: 'moderation',
          label: `Report in ${r.communityName}`,
          detail: r.reason ?? 'Awaiting review',
          href: '/studio/moderation',
          tone: 'warning',
          createdAt: new Date(r.createdAt).toISOString(),
        }),
      ),
      ...(failedPayments > 0
        ? [
            {
              id: 'billing-failed-payments',
              kind: 'billing' as const,
              label: `${failedPayments} member${failedPayments === 1 ? '' : 's'} with a failed payment`,
              detail: 'Payment retry in progress via Stripe dunning — no action required unless it persists.',
              href: '/studio/subscribers',
              tone: 'critical' as const,
              createdAt: new Date().toISOString(),
            },
          ]
        : []),
      ...scheduledVideos.map(
        (v): AttentionItem => ({
          id: `scheduled-${v.id}`,
          kind: 'scheduled',
          label: `Scheduled: "${v.title}"`,
          detail: `Publishes ${new Date(v.scheduled_publish_at).toLocaleString()}`,
          href: `/studio/videos/${v.id}`,
          tone: 'primary',
          createdAt: new Date(v.scheduled_publish_at).toISOString(),
        }),
      ),
    ];

    const TONE_RANK: Record<AttentionItem['tone'], number> = { critical: 0, warning: 1, primary: 2 };
    items.sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone] || b.createdAt.localeCompare(a.createdAt));

    return {
      counts: {
        commentsNeedingReply,
        pendingModeration,
        failedPayments,
        processingFailures,
        scheduledUpcoming,
      },
      items: items.slice(0, 10),
    };
  }

  /**
   * Long-format (section,key,value) CSV of the creator business analytics.
   * Reuses getCreatorBusinessAnalytics so the export always matches the
   * dashboard. Field serialization is CSV-injection hardened via csv.util.
   */
  async getCreatorBusinessAnalyticsCsv(creatorId: string): Promise<string> {
    const a = await this.getCreatorBusinessAnalytics(creatorId);
    const rows: Array<[string, string, number]> = [
      ['membership', 'active', a.membership.active],
      ['membership', 'trial', a.membership.trial],
      ['membership', 'canceled', a.membership.canceled],
      ['membership', 'mrr_cents', a.membership.mrrCents],
      ['kpi', 'churn_rate_30d', a.kpis.churnRate30d],
      ['kpi', 'canceled_last_30d', a.kpis.canceledLast30Days],
      ['kpi', 'engagement_score', a.kpis.engagementScore],
      ['engagement', 'engaged_members', a.engagement.engagedMembers],
      ['engagement', 'active_chatters', a.engagement.activeChatters],
      ['engagement', 'post_authors', a.engagement.postAuthors],
      ['engagement', 'course_enrollments', a.engagement.courseEnrollments],
    ];

    for (const f of a.funnel) {
      rows.push(['funnel', `${f.stage}.count`, f.count]);
      rows.push(['funnel', `${f.stage}.rate_from_top`, f.rateFromTop]);
    }
    for (const c of a.communities) {
      rows.push(['community', `${c.slug}.active_members_7d`, c.activeMembersLast7Days]);
    }
    for (const w of a.cohortRetention?.weekly ?? []) {
      rows.push(['retention_weekly', `${w.period}.retention_rate`, w.retentionRate]);
    }
    for (const m of a.cohortRetention?.monthly ?? []) {
      rows.push(['retention_monthly', `${m.period}.retention_rate`, m.retentionRate]);
    }

    return toCsv(['section', 'key', 'value'], rows);
  }

  private async getSubscriberCohortRetention(creatorId: string) {
    const weeklySince = new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000);
    const monthlySince = new Date();
    monthlySince.setMonth(monthlySince.getMonth() - 6);

    const cohortSelect = `
      COUNT(*)::int AS cohort_size,
      COUNT(*) FILTER (WHERE s.status IN ('active', 'trial', 'grace_period'))::int AS retained,
      COUNT(*) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM (
            SELECT m.user_id
            FROM channel_messages m
            INNER JOIN channels ch ON ch.id = m.channel_id
            INNER JOIN communities c ON c.id = ch.community_id
            WHERE c.creator_id = $1
              AND m.user_id = s.user_id
              AND m.created_at >= NOW() - INTERVAL '30 days'
              AND m.deleted_at IS NULL
            UNION
            SELECT m.user_id
            FROM community_room_messages m
            INNER JOIN community_rooms r ON r.id = m.room_id
            INNER JOIN communities c ON c.id = r.community_id
            WHERE c.creator_id = $1
              AND m.user_id = s.user_id
              AND m.created_at >= NOW() - INTERVAL '30 days'
              AND m.deleted_at IS NULL
          ) engaged WHERE engaged.user_id = s.user_id
        )
      )::int AS engaged_retained
    `;

    const weeklyRows = await this.dataSource.query<
      { period: string; cohort_size: string; retained: string; engaged_retained: string }[]
    >(
      `SELECT to_char(date_trunc('week', s.starts_at), 'YYYY-MM-DD') AS period,
              ${cohortSelect}
       FROM member_subscriptions s
       WHERE s.creator_id = $1 AND s.starts_at >= $2
       GROUP BY 1 ORDER BY 1`,
      [creatorId, weeklySince],
    );

    const monthlyRows = await this.dataSource.query<
      { period: string; cohort_size: string; retained: string; engaged_retained: string }[]
    >(
      `SELECT to_char(date_trunc('month', s.starts_at), 'YYYY-MM') AS period,
              ${cohortSelect}
       FROM member_subscriptions s
       WHERE s.creator_id = $1 AND s.starts_at >= $2
       GROUP BY 1 ORDER BY 1`,
      [creatorId, monthlySince],
    );

    const mapRows = (rows: typeof weeklyRows) =>
      rows.map((r) => {
        const cohortSize = Number(r.cohort_size);
        const retained = Number(r.retained);
        return {
          period: r.period,
          cohortSize,
          retained,
          engagedRetained: Number(r.engaged_retained),
          retentionRate: cohortSize > 0 ? Math.round((retained / cohortSize) * 100) : 0,
        };
      });

    return {
      weekly: mapRows(weeklyRows),
      monthly: mapRows(monthlyRows),
    };
  }

  private async getCommunityRetentionMetrics(creatorId: string, communityId: string) {
    const [activeSubsRow] = await this.dataSource.query<{ count: string }[]>(
      `SELECT COUNT(*)::int AS count FROM member_subscriptions
       WHERE creator_id = $1 AND status IN ('active', 'trial', 'grace_period')`,
      [creatorId],
    );

    let engagedMembers = 0;
    if (isSkillEconomyLmsEnabled()) {
      const [xpMembersRow] = await this.dataSource.query<{ count: string }[]>(
        `SELECT COUNT(DISTINCT user_id)::int AS count FROM member_xp WHERE community_id = $1`,
        [communityId],
      );
      engagedMembers = Number(xpMembersRow?.count ?? 0);
    } else {
      const [engagedRow] = await this.dataSource.query<{ count: string }[]>(
        `SELECT COUNT(DISTINCT user_id)::int AS count FROM (
           SELECT m.user_id
           FROM channel_messages m
           INNER JOIN channels ch ON ch.id = m.channel_id
           WHERE ch.community_id = $1 AND m.deleted_at IS NULL
           UNION
           SELECT m.user_id
           FROM community_room_messages m
           INNER JOIN community_rooms r ON r.id = m.room_id
           WHERE r.community_id = $1 AND m.deleted_at IS NULL
           UNION
           SELECT p.author_id AS user_id
           FROM community_posts p
           WHERE p.community_id = $1
         ) engaged`,
        [communityId],
      );
      engagedMembers = Number(engagedRow?.count ?? 0);
    }

    return {
      activeSubscribers: Number(activeSubsRow?.count ?? 0),
      engagedMembers,
    };
  }

  async getCreatorEcosystemTree(creatorId: string) {
    const lmsOn = isSkillEconomyLmsEnabled();
    const [communities, courseRows, programRows, bundleRows, brandRows] = await Promise.all([
      this.communityRepository.find({ where: { creatorId }, order: { name: 'ASC' } }),
      lmsOn
        ? this.dataSource.query<
            Array<{ id: string; title: string; slug: string; community_id: string | null; is_published: boolean }>
          >(
            `SELECT id, title, slug, community_id, is_published
             FROM courses WHERE creator_id = $1 ORDER BY created_at DESC`,
            [creatorId],
          )
        : Promise.resolve([] as Array<{
            id: string;
            title: string;
            slug: string;
            community_id: string | null;
            is_published: boolean;
          }>),
      lmsOn
        ? this.dataSource.query<
            Array<{
              id: string;
              name: string;
              slug: string;
              community_id: string | null;
              is_published: boolean;
              course_count: string;
            }>
          >(
            `SELECT p.id, p.name, p.slug, p.community_id, p.is_published,
                    COUNT(pc.course_id)::int AS course_count
             FROM creator_programs p
             LEFT JOIN creator_program_courses pc ON pc.program_id = p.id
             WHERE p.creator_id = $1
             GROUP BY p.id
             ORDER BY p.sort_order ASC, p.created_at DESC`,
            [creatorId],
          )
        : Promise.resolve([] as Array<{
            id: string;
            name: string;
            slug: string;
            community_id: string | null;
            is_published: boolean;
            course_count: string;
          }>),
      lmsOn
        ? this.dataSource.query<
            Array<{ id: string; name: string; slug: string; is_active: boolean; item_count: string }>
          >(
            `SELECT b.id, b.name, b.slug, b.is_active,
                    COUNT(i.id)::int AS item_count
             FROM creator_bundles b
             LEFT JOIN creator_bundle_items i ON i.bundle_id = b.id
             WHERE b.creator_id = $1
             GROUP BY b.id
             ORDER BY b.sort_order ASC, b.created_at DESC`,
            [creatorId],
          )
        : Promise.resolve([] as Array<{
            id: string;
            name: string;
            slug: string;
            is_active: boolean;
            item_count: string;
          }>),
      lmsOn
        ? this.dataSource.query<Array<{ id: string; name: string; slug: string }>>(
            `SELECT id, name, slug FROM brands WHERE creator_id = $1 ORDER BY name ASC`,
            [creatorId],
          )
        : Promise.resolve([] as Array<{ id: string; name: string; slug: string }>),
    ]);

    const coursesByCommunity = new Map<string, typeof courseRows>();
    const standaloneCourses: typeof courseRows = [];
    for (const course of courseRows) {
      if (course.community_id) {
        const list = coursesByCommunity.get(course.community_id) ?? [];
        list.push(course);
        coursesByCommunity.set(course.community_id, list);
      } else {
        standaloneCourses.push(course);
      }
    }

    const programsByCommunity = new Map<string, typeof programRows>();
    const standalonePrograms: typeof programRows = [];
    for (const program of programRows) {
      if (program.community_id) {
        const list = programsByCommunity.get(program.community_id) ?? [];
        list.push(program);
        programsByCommunity.set(program.community_id, list);
      } else {
        standalonePrograms.push(program);
      }
    }

    return {
      data: {
        brands: brandRows,
        communities: communities.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          visibility: c.visibility,
          courses: (coursesByCommunity.get(c.id) ?? []).map((course) => ({
            id: course.id,
            title: course.title,
            slug: course.slug,
            isPublished: course.is_published,
          })),
          programs: (programsByCommunity.get(c.id) ?? []).map((program) => ({
            id: program.id,
            name: program.name,
            slug: program.slug,
            isPublished: program.is_published,
            courseCount: Number(program.course_count ?? 0),
          })),
        })),
        standaloneCourses: standaloneCourses.map((course) => ({
          id: course.id,
          title: course.title,
          slug: course.slug,
          isPublished: course.is_published,
        })),
        programs: standalonePrograms.map((program) => ({
          id: program.id,
          name: program.name,
          slug: program.slug,
          isPublished: program.is_published,
          courseCount: Number(program.course_count ?? 0),
        })),
        bundles: bundleRows.map((bundle) => ({
          id: bundle.id,
          name: bundle.name,
          slug: bundle.slug,
          isActive: bundle.is_active,
          itemCount: Number(bundle.item_count ?? 0),
        })),
      },
    };
  }
}
