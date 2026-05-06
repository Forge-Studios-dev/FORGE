import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
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
}

