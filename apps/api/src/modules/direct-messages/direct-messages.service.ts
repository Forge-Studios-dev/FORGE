import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Conversation } from './entities/conversation.entity';
import { ConversationMember } from './entities/conversation-member.entity';
import { DirectMessage } from './entities/direct-message.entity';
import { User } from '../users/entities/user.entity';
import { SendDirectMessageDto } from './dto/direct-message.dto';
import { toPublicUser } from '../users/user.mapper';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

@Injectable()
export class DirectMessagesService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(ConversationMember)
    private readonly memberRepository: Repository<ConversationMember>,
    @InjectRepository(DirectMessage)
    private readonly messageRepository: Repository<DirectMessage>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listConversations(userId: string) {
    const memberships = await this.memberRepository.find({
      where: { userId },
      relations: ['conversation', 'conversation.members', 'conversation.members.user'],
      order: { createdAt: 'DESC' },
      take: 50,
    });

    return memberships.map((m) => {
      const others = m.conversation.members.filter((x) => x.userId !== userId);
      return {
        conversationId: m.conversationId,
        lastReadAt: m.lastReadAt,
        participants: others.map((o) => toPublicUser(o.user)),
      };
    });
  }

  async getMessages(userId: string, conversationId: string, limit = 50, cursor?: string) {
    await this.assertMember(userId, conversationId);

    const qb = this.messageRepository
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.sender', 'sender')
      .where('m.conversation_id = :conversationId', { conversationId })
      .andWhere('m.deleted_at IS NULL')
      .orderBy('m.created_at', 'DESC')
      .take(Math.min(limit, 50) + 1);

    if (cursor) {
      const cursorDate = new Date(Buffer.from(cursor, 'base64').toString('utf-8'));
      qb.andWhere('m.created_at < :cursor', { cursor: cursorDate });
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
      ? Buffer.from(page[page.length - 1].createdAt.toISOString()).toString('base64')
      : null;

    return {
      data: page.reverse().map((m) => this.toPublicMessage(m)),
      meta: { cursor: nextCursor, hasMore },
    };
  }

  async sendMessage(senderId: string, dto: SendDirectMessageDto) {
    if (senderId === dto.recipientId) {
      throw new BadRequestException('Cannot message yourself');
    }

    const recipient = await this.userRepository.findOne({ where: { id: dto.recipientId } });
    if (!recipient) throw new NotFoundException('Recipient not found');

    const conversation = await this.findOrCreateDmConversation(senderId, dto.recipientId);

    const msg = await this.messageRepository.save(
      this.messageRepository.create({
        conversationId: conversation.id,
        senderId,
        content: dto.content.trim(),
      }),
    );

    await this.conversationRepository.update(conversation.id, { updatedAt: new Date() });

    const full = await this.messageRepository.findOne({
      where: { id: msg.id },
      relations: ['sender'],
    });

    const publicMsg = this.toPublicMessage(full!);
    const recipientIds = [dto.recipientId];

    this.eventEmitter.emit('direct-message.sent', {
      conversationId: conversation.id,
      message: publicMsg,
      recipientIds,
    });

    const sender = full?.sender;
    await this.notificationsService.create({
      userId: dto.recipientId,
      type: NotificationType.DIRECT_MESSAGE,
      title: 'New message',
      body: `${sender?.displayName ?? 'Someone'} sent you a message`,
      metadata: { conversationId: conversation.id, messageId: msg.id },
    });

    return publicMsg;
  }

  async markRead(userId: string, conversationId: string) {
    const member = await this.memberRepository.findOne({ where: { userId, conversationId } });
    if (!member) throw new ForbiddenException();
    member.lastReadAt = new Date();
    await this.memberRepository.save(member);
    return { ok: true };
  }

  private async findOrCreateDmConversation(userA: string, userB: string): Promise<Conversation> {
    const existing = await this.conversationRepository
      .createQueryBuilder('c')
      .innerJoin('c.members', 'm1', 'm1.user_id = :userA', { userA })
      .innerJoin('c.members', 'm2', 'm2.user_id = :userB', { userB })
      .getOne();

    if (existing) return existing;

    return this.dataSource.transaction(async (manager) => {
      const conv = await manager.save(manager.create(Conversation, {}));
      await manager.save([
        manager.create(ConversationMember, { conversationId: conv.id, userId: userA }),
        manager.create(ConversationMember, { conversationId: conv.id, userId: userB }),
      ]);
      return conv;
    });
  }

  private async assertMember(userId: string, conversationId: string) {
    const member = await this.memberRepository.findOne({ where: { userId, conversationId } });
    if (!member) throw new ForbiddenException('Not a member of this conversation');
    return member;
  }

  private toPublicMessage(m: DirectMessage) {
    return {
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      sender: m.sender ? toPublicUser(m.sender) : undefined,
      content: m.content,
      createdAt: m.createdAt,
    };
  }
}
