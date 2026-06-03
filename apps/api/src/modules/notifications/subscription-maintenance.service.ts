import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { NotificationsService } from './notifications.service';
import { NotificationType } from './entities/notification.entity';
import { PushDispatchService } from './push-dispatch.service';

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
    try {
      const expiring = await this.entitlementsService.getExpiringSubscriptions(3);
      for (const sub of expiring) {
        const dedupeKey = `sub:expiring:notified:${sub.id}`;
        const already = await this.redis.get(dedupeKey);
        if (already) continue;

        const tierName = sub.tier?.name ?? 'Membership';
        const daysLeft = sub.expiresAt
          ? Math.ceil((sub.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
          : 3;

        await this.notificationsService.create({
          userId: sub.userId,
          type: NotificationType.SUBSCRIPTION_EXPIRING,
          title: `${tierName} expiring soon`,
          body: `Your membership expires in ${daysLeft} day(s).`,
          metadata: {
            subscriptionId: sub.id,
            creatorId: sub.creatorId,
            tierId: sub.tierId,
            expiresAt: sub.expiresAt?.toISOString(),
          },
        });
        await this.pushDispatch.enqueueForUser(sub.userId, {
          title: `${tierName} expiring soon`,
          body: `Your membership expires in ${daysLeft} day(s).`,
          data: { type: 'subscription_expiring', creatorId: sub.creatorId },
        });
        await this.redis.setex(dedupeKey, 3 * 24 * 60 * 60, '1');
      }

      const expired = await this.entitlementsService.expireDueSubscriptions();
      if (expired > 0) {
        this.logger.log(`Expired ${expired} subscriptions`);
      }
    } catch (err) {
      this.logger.warn(`Subscription maintenance failed: ${(err as Error).message}`);
    }
  }
}
