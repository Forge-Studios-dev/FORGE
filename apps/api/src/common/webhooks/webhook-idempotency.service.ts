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

  private isUniqueViolation(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code?: string }).code ?? '')
        : '';
    return (
      code === '23505' ||
      message.includes('duplicate') ||
      message.includes('unique') ||
      message.includes('UNIQUE')
    );
  }

  /**
   * Returns true if this event was already processed (duplicate).
   * Prefer {@link tryAcquire} for new call sites — check-then-act races.
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

  /**
   * Atomically claim an event for processing via unique DB insert + Redis cache.
   * @returns true if this caller should process; false if duplicate.
   */
  async tryAcquire(provider: string, eventId: string, eventType?: string): Promise<boolean> {
    if (!eventId) return true;

    const key = this.redisKey(provider, eventId);
    const cached = await this.redis.get(key);
    if (cached) return false;

    try {
      await this.webhookEventRepository.insert({
        provider,
        eventId,
        eventType: eventType ?? null,
        processedAt: new Date(),
      });
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        await this.redis.setex(key, REDIS_TTL_SEC, '1');
        return false;
      }
      throw err;
    }

    await this.redis.setex(key, REDIS_TTL_SEC, '1');
    return true;
  }

  /**
   * Undo a failed acquire so Stripe/Mux retries can redeliver.
   * Call only after {@link tryAcquire} returned true and processing threw.
   */
  async release(provider: string, eventId: string): Promise<void> {
    if (!eventId) return;
    try {
      await this.webhookEventRepository.delete({ provider, eventId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Webhook idempotency release DB failed: ${message}`);
    }
    await this.redis.del(this.redisKey(provider, eventId));
  }

  /**
   * Legacy complete marker. With {@link tryAcquire} the row already exists;
   * this refreshes Redis and is a no-op insert on unique conflict.
   */
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
      if (this.isUniqueViolation(err)) {
        this.logger.debug(`Webhook already recorded: ${provider}:${eventId}`);
      } else {
        this.logger.warn(`Webhook idempotency persist failed: ${message}`);
      }
    }

    await this.redis.setex(this.redisKey(provider, eventId), REDIS_TTL_SEC, '1');
  }
}
