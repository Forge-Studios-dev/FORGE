import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { categoryForNotificationType } from '@forge/shared-types';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { MemberSubscriptionStatus } from '../entitlements/entities/member-subscription.entity';
import { NotificationsService } from './notifications.service';
import { NotificationType } from './entities/notification.entity';
import { PushDispatchService } from './push-dispatch.service';
import { isPlatformDormant } from '../../common/streaming/platform-dormant.util';

@Injectable()
export class SubscriptionMaintenanceService {
  private readonly logger = new Logger(SubscriptionMaintenanceService.name);

  constructor(
    private readonly entitlementsService: EntitlementsService,
    private readonly notificationsService: NotificationsService,
    private readonly pushDispatch: PushDispatchService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  /** Invoked by BullMQ worker (hourly repeatable job). */
  async runMaintenance() {
    // Isolate notify vs expire so one path cannot skip the other.
    try {
      await this.notifyExpiringSubscriptions();
    } catch (err) {
      this.logger.warn(
        `Subscription expiring notify failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }

    try {
      const expired = await this.entitlementsService.expireDueSubscriptions();
      if (expired > 0) {
        this.logger.log(`Expired ${expired} subscriptions`);
      }
    } catch (err) {
      this.logger.warn(
        `Subscription expire failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  private async notifyExpiringSubscriptions() {
    const dormant = await isPlatformDormant(this.redis);
    if (dormant) {
      this.logger.debug('Subscription expiring scan skipped — platform dormant');
      return;
    }

    const expiring = await this.entitlementsService.getExpiringSubscriptions(3);
    if (!expiring.length) return;

    // M-B2: one MGET replaces N sequential `redis.get` round-trips. Previously
    // the loop paid a Redis RTT per subscription just to see if we'd already
    // notified — a 500-row scan meant 500 sequential awaits before any
    // notification fanned out. Now the dedupe filter is a single call.
    const dedupeKeys = expiring.map((sub) => `sub:expiring:notified:${sub.id}`);
    const alreadyNotified = await this.redis.mget(...dedupeKeys);

    const pending: Array<{
      userId: string;
      title: string;
      body: string;
      metadata: Record<string, unknown>;
      pushData: Record<string, string>;
      dedupeKey: string;
    }> = [];

    for (let i = 0; i < expiring.length; i++) {
      if (alreadyNotified[i]) continue;
      const sub = expiring[i];

      const tierName = sub.tier?.name ?? 'Membership';
      const daysLeft = sub.expiresAt
        ? Math.ceil((sub.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
        : 3;
      const isTrial = sub.status === MemberSubscriptionStatus.TRIAL;
      const title = isTrial
        ? `${tierName} trial ending soon`
        : `${tierName} expiring soon`;
      const body = isTrial
        ? `Your free trial ends in ${daysLeft} day(s). Add a payment method to keep access.`
        : `Your membership expires in ${daysLeft} day(s).`;

      pending.push({
        userId: sub.userId,
        title,
        body,
        metadata: {
          subscriptionId: sub.id,
          creatorId: sub.creatorId,
          tierId: sub.tierId,
          expiresAt: sub.expiresAt?.toISOString(),
          isTrial,
        },
        pushData: {
          type: isTrial ? 'trial_ending' : 'subscription_expiring',
          creatorId: sub.creatorId,
        },
        dedupeKey: dedupeKeys[i],
      });
    }

    if (!pending.length) return;

    // Send first, mark dedupe second — reserving the dedupe key up front (the
    // original approach) meant a send failure still left the user "notified"
    // for 3 days with nothing ever actually sent, since this whole method
    // only logs and doesn't retry on throw (see runMaintenance's try/catch).
    await Promise.all([
      this.notificationsService.createMany(
        pending.map((item) => ({
          userId: item.userId,
          type: NotificationType.SUBSCRIPTION_EXPIRING,
          title: item.title,
          body: item.body,
          metadata: item.metadata,
        })),
      ),
      this.pushDispatch.enqueueMany(
        pending.map((item) => ({
          userId: item.userId,
          title: item.title,
          body: item.body,
          data: item.pushData,
          category: categoryForNotificationType(NotificationType.SUBSCRIPTION_EXPIRING),
        })),
      ),
    ]);

    const pipeline = this.redis.pipeline();
    for (const item of pending) {
      pipeline.setex(item.dedupeKey, 3 * 24 * 60 * 60, '1');
    }
    await pipeline.exec();
  }
}
