import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StreamMessage } from './entities/stream-message.entity';
import { StreamModerationAction } from './entities/stream-moderation-action.entity';
import { StreamChatService } from './stream-chat.service';
import { StreamChatController } from './stream-chat.controller';
import { StreamingModule } from '../streaming/streaming.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([StreamMessage, StreamModerationAction]),
    StreamingModule,
    EntitlementsModule,
  ],
  controllers: [StreamChatController],
  providers: [StreamChatService],
  exports: [StreamChatService],
})
export class StreamChatModule {}
