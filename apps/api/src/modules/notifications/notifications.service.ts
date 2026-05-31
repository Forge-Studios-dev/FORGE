import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { DeviceToken, DevicePlatform } from './entities/device-token.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepository: Repository<DeviceToken>,
  ) {}

  create(input: {
    userId: string;
    type: NotificationType;
    title: string;
    body?: string | null;
    metadata?: Record<string, unknown> | null;
  }) {
    const notif = this.notificationRepository.create({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      metadata: input.metadata ?? null,
      readAt: null,
    });
    return this.notificationRepository.save(notif);
  }

  listForUser(userId: string) {
    return this.notificationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async markRead(userId: string, id: string) {
    const notif = await this.notificationRepository.findOne({ where: { id, userId } });
    if (!notif) throw new NotFoundException('Notification not found');
    if (!notif.readAt) {
      notif.readAt = new Date();
      await this.notificationRepository.save(notif);
    }
    return notif;
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

