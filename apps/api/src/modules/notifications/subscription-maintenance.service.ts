import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
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
    try {
      const dormant = await isPlatformDormant(this.redis);

      if (!dormant) {
        const expiring = await this.entitlementsService.getExpiringSubscriptions(3);
        const pending: Array<{
          userId: string;
          title: string;
          body: string;
          metadata: Record<string, unknown>;
          pushData: Record<string, string>;
        }> = [];

        for (const sub of expiring) {
          const dedupeKey = `sub:expiring:notified:${sub.id}`;
          const already = await this.redis.get(dedupeKey);
          if (already) continue;

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
          });
          await this.redis.setex(dedupeKey, 3 * 24 * 60 * 60, '1');
        }

        if (pending.length) {
          await this.notificationsService.createMany(
            pending.map((item) => ({
              userId: item.userId,
              type: NotificationType.SUBSCRIPTION_EXPIRING,
              title: item.title,
              body: item.body,
              metadata: item.metadata,
            })),
          );
          await this.pushDispatch.enqueueMany(
            pending.map((item) => ({
              userId: item.userId,
              title: item.title,
              body: item.body,
              data: item.pushData,
            })),
          );
        }
      } else {
        this.logger.debug('Subscription expiring scan skipped — platform dormant');
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
