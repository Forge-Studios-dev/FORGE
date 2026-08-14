import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DirectMessagesController } from './direct-messages.controller';
import { DirectMessagesService } from './direct-messages.service';
import { Conversation } from './entities/conversation.entity';
import { ConversationMember } from './entities/conversation-member.entity';
import { DirectMessage } from './entities/direct-message.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { EngagementModule } from '../engagement/engagement.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, ConversationMember, DirectMessage, User]),
    NotificationsModule,
    EngagementModule,
  ],
  controllers: [DirectMessagesController],
  providers: [DirectMessagesService],
  exports: [DirectMessagesService],
})
export class DirectMessagesModule {}
