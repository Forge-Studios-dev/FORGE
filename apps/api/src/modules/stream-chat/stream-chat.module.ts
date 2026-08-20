import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StreamMessage } from './entities/stream-message.entity';
import { StreamModerationAction } from './entities/stream-moderation-action.entity';
import { StreamChatService } from './stream-chat.service';
import { StreamChatController } from './stream-chat.controller';
import { StreamQaController } from './stream-qa.controller';
import { StreamingModule } from '../streaming/streaming.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { User } from '../users/entities/user.entity';
import { STREAM_CHAT_INGEST_QUEUE } from '../workers/stream-chat-ingest/stream-chat-ingest.constants';

import { UsersModule } from '../users/users.module';
import { BillingModule } from '../billing/billing.module';
import { EngagementModule } from '../engagement/engagement.module';
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [
    BullModule.registerQueue({ name: STREAM_CHAT_INGEST_QUEUE }),
    TypeOrmModule.forFeature([StreamMessage, StreamModerationAction, User]),
    forwardRef(() => StreamingModule),
    forwardRef(() => EntitlementsModule),
    forwardRef(() => UsersModule),
    EngagementModule,
    forwardRef(() => BillingModule),
  ],
  controllers: [StreamChatController, StreamQaController],
  providers: [StreamChatService],
  exports: [StreamChatService],
})
export class StreamChatModule {}
