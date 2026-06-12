import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Notification } from './entities/notification.entity';
import { DeviceToken } from './entities/device-token.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsListener } from './notifications.listener';
import { PushDispatchService } from './push-dispatch.service';
import { SubscriptionMaintenanceService } from './subscription-maintenance.service';
import { User } from '../users/entities/user.entity';
import { Follow } from '../engagement/entities/follow.entity';
import { Comment } from '../engagement/entities/comment.entity';
import { PUSH_DISPATCH_QUEUE } from './push-dispatch.constants';
import { SUBSCRIPTION_MAINTENANCE_QUEUE } from './subscription-maintenance.constants';
import { SubscriptionMaintenanceScheduler } from './subscription-maintenance.scheduler';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { PremiumContentNotifyService } from './premium-content-notify.service';
import { PREMIUM_CONTENT_NOTIFY_QUEUE } from '../workers/premium-content-notify/premium-content-notify.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, DeviceToken, User, Follow, Comment]),
    forwardRef(() => EntitlementsModule),
    BullModule.registerQueue({
      name: PUSH_DISPATCH_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: { age: 3600, count: 5000 },
        removeOnFail: { age: 86400, count: 5000 },
      },
    }),
    BullModule.registerQueue({
      name: SUBSCRIPTION_MAINTENANCE_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { age: 86400, count: 48 },
        removeOnFail: { age: 7 * 86400, count: 100 },
      },
    }),
    BullModule.registerQueue({
      name: PREMIUM_CONTENT_NOTIFY_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 3600, count: 5000 },
        removeOnFail: { age: 86400, count: 500 },
      },
    }),
  ],
  providers: [
    NotificationsService,
    NotificationsListener,
    PushDispatchService,
    SubscriptionMaintenanceService,
    SubscriptionMaintenanceScheduler,
    PremiumContentNotifyService,
  ],
  controllers: [NotificationsController],
  exports: [
    NotificationsService,
    PushDispatchService,
    SubscriptionMaintenanceService,
    PremiumContentNotifyService,
  ],
})
export class NotificationsModule {}
