import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { PlatformEventOutbox } from './entities/platform-event-outbox.entity';
import { PlatformEventOutboxService } from './platform-event-outbox.service';
import { PLATFORM_EVENT_OUTBOX_QUEUE } from '../workers/platform-event-outbox/platform-event-outbox.constants';
import { COMMUNITY_ANNOUNCEMENT_NOTIFY_QUEUE } from '../workers/community-announcement-notify/community-announcement-notify.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlatformEventOutbox]),
    BullModule.registerQueue({
      name: PLATFORM_EVENT_OUTBOX_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 3600, count: 5000 },
        removeOnFail: { age: 86400, count: 500 },
      },
    }),
    BullModule.registerQueue({ name: COMMUNITY_ANNOUNCEMENT_NOTIFY_QUEUE }),
  ],
  providers: [PlatformEventOutboxService],
  exports: [PlatformEventOutboxService],
})
export class PlatformEventOutboxModule {}
