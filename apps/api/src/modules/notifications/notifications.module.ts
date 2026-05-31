import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Notification } from './entities/notification.entity';
import { DeviceToken } from './entities/device-token.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsListener } from './notifications.listener';
import { PushDispatchService } from './push-dispatch.service';
import { User } from '../users/entities/user.entity';
import { PUSH_DISPATCH_QUEUE } from './push-dispatch.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, DeviceToken, User]),
    BullModule.registerQueue({
      name: PUSH_DISPATCH_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: { age: 3600, count: 5000 },
        removeOnFail: { age: 86400, count: 5000 },
      },
    }),
  ],
  providers: [NotificationsService, NotificationsListener, PushDispatchService],
  controllers: [NotificationsController],
  exports: [NotificationsService, PushDispatchService],
})
export class NotificationsModule {}

