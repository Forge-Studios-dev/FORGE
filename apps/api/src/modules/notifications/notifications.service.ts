import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { categoryForNotificationType, isCategoryMuted, isMuteExemptNotificationType } from '@forge/shared-types';
import { Notification, NotificationType } from './entities/notification.entity';
import { DeviceToken, DevicePlatform } from './entities/device-token.entity';
import { User } from '../users/entities/user.entity';
import {
  bustUnreadCountCache,
  getCachedUnreadCount,
  setCachedUnreadCount,
} from '../../common/notifications/unread-count-cache.util';
import { EngagementService } from '../engagement/engagement.service';
import { notificationInvolvesBlockedPeer } from './notification-actor.util';

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  metadata?: Record<string, unknown> | null;
};

@Injectable()
export class NotificationsService {
  private static readonly INSERT_CHUNK = 500;
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepository: Repository<DeviceToken>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly eventEmitter: EventEmitter2,
    private readonly engagementService: EngagementService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  /**
   * Single choke point for the mute check: every notification, from every
   * module, is written through create()/createMany(), so gating here covers
   * unread count, the notification list, and the live socket push at once —
   * no need to touch each of the ~10 event handlers that call these.
   */
  private async isMutedForUser(userId: string, type: NotificationType): Promise<boolean> {
    if (isMuteExemptNotificationType(type)) return false;
    const row = await this.userRepository.findOne({
      where: { id: userId },
      select: { id: true, notificationPreferences: true },
    });
    return isCategoryMuted(row?.notificationPreferences, categoryForNotificationType(type));
  }

  async create(input: CreateNotificationInput): Promise<Notification | null> {
    if (await this.isMutedForUser(input.userId, input.type)) return null;

    const notif = this.notificationRepository.create({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      metadata: input.metadata ?? null,
      readAt: null,
    });
    const saved = await this.notificationRepository.save(notif);
    void bustUnreadCountCache(this.redis, input.userId, this.logger);
    this.eventEmitter.emit('notification.created', {
      userId: input.userId,
      notification: saved,
    });
    return saved;
  }

  /** Bulk INSERT for fan-out notifications (go-live, premium content, etc.). */
  async createMany(inputs: CreateNotificationInput[]): Promise<void> {
    if (!inputs.length) return;

    const userIds = [...new Set(inputs.map((i) => i.userId))];
    const prefRows = await this.userRepository.find({
      where: { id: In(userIds) },
      select: { id: true, notificationPreferences: true },
    });
    const prefsById = new Map(prefRows.map((r) => [r.id, r.notificationPreferences]));
    const eligible = inputs.filter(
      (input) =>
        isMuteExemptNotificationType(input.type) ||
        !isCategoryMuted(prefsById.get(input.userId), categoryForNotificationType(input.type)),
    );
    if (!eligible.length) return;

    for (let i = 0; i < eligible.length; i += NotificationsService.INSERT_CHUNK) {
      const chunk = eligible.slice(i, i + NotificationsService.INSERT_CHUNK);
      const entities = chunk.map((input) =>
        this.notificationRepository.create({
          userId: input.userId,
          type: input.type,
          title: input.title,
          body: input.body ?? null,
          metadata: input.metadata ?? null,
          readAt: null,
        }),
      );
      const saved = await this.notificationRepository.save(entities);
      const savedUserIds = new Set(saved.map((n) => n.userId));
      for (const uid of savedUserIds) {
        void bustUnreadCountCache(this.redis, uid, this.logger);
      }
      for (const notif of saved) {
        this.eventEmitter.emit('notification.created', {
          userId: notif.userId,
          notification: notif,
        });
      }
    }
  }

  async listForUser(
    userId: string,
    opts?: { cursor?: string; limit?: number },
  ): Promise<{ data: Notification[]; meta: { cursor: string | null; hasMore: boolean } }> {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 50);
    const blockedPeers = await this.engagementService.getBlockedPeerIds(userId);
    const blockedSet = new Set(blockedPeers);
    const qb = this.notificationRepository
      .createQueryBuilder('n')
      .where('n.user_id = :userId', { userId })
      .orderBy('n.created_at', 'DESC')
      .addOrderBy('n.id', 'DESC')
      // Over-fetch slightly so post-filter for blocked actors still fills a page.
      .take(limit + 1 + Math.min(blockedPeers.length, 20));

    if (opts?.cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(opts.cursor, 'base64url').toString('utf-8')) as {
          createdAt: string;
          id: string;
        };
        const cursorDate = new Date(decoded.createdAt);
        if (!Number.isNaN(cursorDate.getTime()) && decoded.id) {
          qb.andWhere(
            '(n.created_at < :cursorDate OR (n.created_at = :cursorDate AND n.id < :cursorId))',
            { cursorDate, cursorId: decoded.id },
          );
        }
      } catch {
        // Invalid cursor — return first page
      }
    }

    const rows = await qb.getMany();
    const visible =
      blockedSet.size === 0
        ? rows
        : rows.filter((n) => !notificationInvolvesBlockedPeer(n.metadata, blockedSet));
    const hasMore = visible.length > limit;
    const data = hasMore ? visible.slice(0, limit) : visible;
    const last = data[data.length - 1];
    const nextCursor =
      hasMore && last
        ? Buffer.from(JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id }), 'utf-8').toString(
            'base64url',
          )
        : null;

    return { data, meta: { cursor: nextCursor, hasMore } };
  }

  async getUnreadCount(userId: string): Promise<number> {
    const cached = await getCachedUnreadCount(this.redis, userId, this.logger);
    if (cached != null) return cached;

    const count = await this.notificationRepository.count({
      where: { userId, readAt: IsNull() },
    });
    void setCachedUnreadCount(this.redis, userId, count, this.logger);
    return count;
  }

  async markRead(userId: string, id: string) {
    const notif = await this.notificationRepository.findOne({ where: { id, userId } });
    if (!notif) throw new NotFoundException('Notification not found');
    if (!notif.readAt) {
      notif.readAt = new Date();
      await this.notificationRepository.save(notif);
      void bustUnreadCountCache(this.redis, userId, this.logger);
    }
    return notif;
  }

  async markAllRead(userId: string) {
    await this.notificationRepository.update(
      { userId, readAt: IsNull() },
      { readAt: new Date() },
    );
    void bustUnreadCountCache(this.redis, userId, this.logger);
    return { ok: true };
  }

  async registerDevice(userId: string, platform: DevicePlatform, fcmToken: string) {
    const existing = await this.deviceTokenRepository.findOne({ where: { fcmToken } });
    if (existing) {
      if (existing.userId !== userId) {
        existing.userId = userId;
        existing.revokedAt = null;
      }
      existing.platform = platform;
      existing.lastSeenAt = new Date();
      return this.deviceTokenRepository.save(existing);
    }
    return this.deviceTokenRepository.save(
      this.deviceTokenRepository.create({
        userId,
        platform,
        fcmToken,
        lastSeenAt: new Date(),
        revokedAt: null,
      }),
    );
  }

  async revokeDevice(userId: string, fcmToken?: string) {
    if (fcmToken) {
      await this.deviceTokenRepository.update(
        { userId, fcmToken, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
      return;
    }
    await this.deviceTokenRepository.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }
}
