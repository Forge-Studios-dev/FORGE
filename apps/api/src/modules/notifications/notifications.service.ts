import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Notification, NotificationType } from './entities/notification.entity';
import { DeviceToken, DevicePlatform } from './entities/device-token.entity';
import {
  bustUnreadCountCache,
  getCachedUnreadCount,
  setCachedUnreadCount,
} from '../../common/notifications/unread-count-cache.util';

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
    private readonly eventEmitter: EventEmitter2,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async create(input: CreateNotificationInput) {
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

    for (let i = 0; i < inputs.length; i += NotificationsService.INSERT_CHUNK) {
      const chunk = inputs.slice(i, i + NotificationsService.INSERT_CHUNK);
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
      const userIds = new Set(saved.map((n) => n.userId));
      for (const uid of userIds) {
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
    const qb = this.notificationRepository
      .createQueryBuilder('n')
      .where('n.user_id = :userId', { userId })
      .orderBy('n.created_at', 'DESC')
      .addOrderBy('n.id', 'DESC')
      .take(limit + 1);

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
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
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
