import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { WebhookEvent } from '../../modules/streaming/entities/webhook-event.entity';

const REDIS_TTL_SEC = 86_400;

@Injectable()
export class WebhookIdempotencyService {
  private readonly logger = new Logger(WebhookIdempotencyService.name);

  constructor(
    @InjectRepository(WebhookEvent)
    private readonly webhookEventRepository: Repository<WebhookEvent>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private redisKey(provider: string, eventId: string): string {
    return `webhook:processed:${provider}:${eventId}`;
  }

  /**
   * Returns true if this event was already processed (duplicate).
   * Uses Redis fast-path + Postgres durable store.
   */
  async isDuplicate(provider: string, eventId: string): Promise<boolean> {
    if (!eventId) return false;

    const cached = await this.redis.get(this.redisKey(provider, eventId));
    if (cached) return true;

    const existing = await this.webhookEventRepository.findOne({
      where: { provider, eventId },
      select: ['id'],
    });
    if (existing) {
      await this.redis.setex(this.redisKey(provider, eventId), REDIS_TTL_SEC, '1');
      return true;
    }
    return false;
  }

  async markProcessed(provider: string, eventId: string, eventType?: string): Promise<void> {
    if (!eventId) return;

    try {
      await this.webhookEventRepository.save(
        this.webhookEventRepository.create({
          provider,
          eventId,
          eventType: eventType ?? null,
          processedAt: new Date(),
        }),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('duplicate') || message.includes('unique')) {
        this.logger.debug(`Webhook already recorded: ${provider}:${eventId}`);
      } else {
        this.logger.warn(`Webhook idempotency persist failed: ${message}`);
      }
    }

    await this.redis.setex(this.redisKey(provider, eventId), REDIS_TTL_SEC, '1');
  }
}
