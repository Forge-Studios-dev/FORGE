import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import {
  PlatformEventOutbox,
  PlatformEventOutboxStatus,
} from './entities/platform-event-outbox.entity';
import {
  PLATFORM_EVENT_OUTBOX_QUEUE,
  type PlatformEventOutboxJobData,
} from '../workers/platform-event-outbox/platform-event-outbox.constants';
import {
  COMMUNITY_ANNOUNCEMENT_NOTIFY_QUEUE,
  type CommunityAnnouncementNotifyJobData,
} from '../workers/community-announcement-notify/community-announcement-notify.constants';

export const PLATFORM_EVENT_TYPES = {
  COMMUNITY_ANNOUNCEMENT_NOTIFY: 'community.announcement.notify',
} as const;

const MAX_ATTEMPTS = 5;

@Injectable()
export class PlatformEventOutboxService {
  private readonly logger = new Logger(PlatformEventOutboxService.name);

  constructor(
    @InjectRepository(PlatformEventOutbox)
    private readonly outboxRepository: Repository<PlatformEventOutbox>,
    @Optional()
    @InjectQueue(PLATFORM_EVENT_OUTBOX_QUEUE)
    private readonly outboxQueue?: Queue<PlatformEventOutboxJobData>,
    @Optional()
    @InjectQueue(COMMUNITY_ANNOUNCEMENT_NOTIFY_QUEUE)
    private readonly announcementQueue?: Queue<CommunityAnnouncementNotifyJobData>,
  ) {}

  async append(input: {
    eventType: string;
    payload: Record<string, unknown>;
    idempotencyKey?: string;
  }): Promise<PlatformEventOutbox> {
    if (input.idempotencyKey) {
      const existing = await this.outboxRepository.findOne({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return existing;
    }

    const row = await this.outboxRepository.save(
      this.outboxRepository.create({
        eventType: input.eventType,
        payload: input.payload,
        idempotencyKey: input.idempotencyKey ?? null,
        status: PlatformEventOutboxStatus.PENDING,
      }),
    );

    if (this.outboxQueue) {
      await this.outboxQueue.add(
        'dispatch',
        { eventId: row.id },
        { jobId: `outbox:${row.id}`, removeOnComplete: true },
      );
    }

    return row;
  }

  async dispatchEvent(eventId: string): Promise<void> {
    const event = await this.outboxRepository.findOne({ where: { id: eventId } });
    if (!event) return;
    if (
      event.status === PlatformEventOutboxStatus.PROCESSED ||
      event.status === PlatformEventOutboxStatus.PROCESSING
    ) {
      return;
    }

    event.status = PlatformEventOutboxStatus.PROCESSING;
    event.attempts += 1;
    await this.outboxRepository.save(event);

    try {
      await this.routeEvent(event);
      event.status = PlatformEventOutboxStatus.PROCESSED;
      event.processedAt = new Date();
      event.lastError = null;
      await this.outboxRepository.save(event);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      event.lastError = message.slice(0, 2000);
      event.status =
        event.attempts >= MAX_ATTEMPTS
          ? PlatformEventOutboxStatus.FAILED
          : PlatformEventOutboxStatus.PENDING;
      await this.outboxRepository.save(event);
      this.logger.warn(`Outbox dispatch failed for ${eventId}: ${message}`);
      throw err;
    }
  }

  private async routeEvent(event: PlatformEventOutbox): Promise<void> {
    switch (event.eventType) {
      case PLATFORM_EVENT_TYPES.COMMUNITY_ANNOUNCEMENT_NOTIFY: {
        const payload = event.payload as CommunityAnnouncementNotifyJobData;
        if (!this.announcementQueue) {
          throw new Error('Announcement queue unavailable');
        }
        await this.announcementQueue.add('notify', payload, {
          jobId: `announcement:${payload.postId}`,
        });
        return;
      }
      default:
        throw new Error(`Unknown outbox event type: ${event.eventType}`);
    }
  }
}
