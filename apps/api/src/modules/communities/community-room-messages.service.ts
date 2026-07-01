import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { CommunityRoom, CommunityRoomType } from './entities/community-room.entity';
import { CommunityRoomMessage } from './entities/community-room-message.entity';
import { CommunitiesService } from './communities.service';
import { CommunityModerationService } from './community-moderation.service';
import { AiCommunityService } from './ai-community.service';
import { CommunityModerationQueueService } from './community-moderation-queue.service';
import { AccessSessionsService } from '../access-sessions/access-sessions.service';
import { AccessSessionType } from '../access-sessions/dto/access-session.dto';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { UserRole } from '../users/entities/user.entity';
import { CommunityRoomPermission } from './entities/community-room-message.entity';
import { CommunityRoomPermissionsService } from './community-room-permissions.service';
import { toPublicRoomMessage } from './community.mapper';
import { ChannelMigrationService } from './channel-migration.service';

@Injectable()
export class CommunityRoomMessagesService {
  constructor(
    @InjectRepository(CommunityRoom)
    private readonly roomRepository: Repository<CommunityRoom>,
    @InjectRepository(CommunityRoomMessage)
    private readonly messageRepository: Repository<CommunityRoomMessage>,
    private readonly communitiesService: CommunitiesService,
    private readonly moderationService: CommunityModerationService,
    private readonly aiCommunityService: AiCommunityService,
    private readonly moderationQueueService: CommunityModerationQueueService,
    private readonly accessSessionsService: AccessSessionsService,
    private readonly entitlementsService: EntitlementsService,
    private readonly roomPermissionsService: CommunityRoomPermissionsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly channelMigrationService: ChannelMigrationService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private async emitChannelBridge(roomId: string, publicMsg: ReturnType<typeof toPublicRoomMessage>) {
    const channelId = await this.channelMigrationService.resolveChannelIdForRoom(roomId);
    if (!channelId) return;
    const { roomId: _roomId, parentMessageId, ...rest } = publicMsg;
    this.eventEmitter.emit('channel.message', {
      channelId,
      message: { ...rest, channelId, parentId: parentMessageId ?? null },
    });
  }

  private async getTextRoom(communityId: string, roomId: string) {
    const room = await this.roomRepository.findOne({
      where: { id: roomId, communityId, isActive: true },
      relations: ['community'],
    });
    if (!room) throw new NotFoundException('Room not found');
    if (room.roomType !== CommunityRoomType.TEXT) {
      throw new BadRequestException('Only text rooms support messaging');
    }
    return room;
  }

  async listMessages(
    communityId: string,
    roomId: string,
    limit = 50,
    cursor?: string,
    parentMessageId?: string,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ) {
    await this.communitiesService.assertCommunityAccess(communityId, viewerId, viewerRole);
    const room = await this.getTextRoom(communityId, roomId);
    await this.roomPermissionsService.assertRoomPermissionIfRestricted(
      communityId,
      roomId,
      viewerId,
      CommunityRoomPermission.VIEW,
      viewerRole,
    );

    const query = this.messageRepository
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.user', 'user')
      .where('m.room_id = :roomId', { roomId })
      .orderBy('m.created_at', 'DESC')
      .take(limit + 1);

    if (parentMessageId) {
      query.andWhere('m.parent_message_id = :parentMessageId', { parentMessageId });
    } else {
      query.andWhere('m.parent_message_id IS NULL');
    }

    if (cursor) {
      const cursorDate = new Date(Buffer.from(cursor, 'base64').toString('utf-8'));
      query.andWhere('m.created_at < :cursor', { cursor: cursorDate });
    }

    const messages = await query.getMany();
    const hasMore = messages.length > limit;
    const data = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore
      ? Buffer.from(data[data.length - 1].createdAt.toISOString()).toString('base64')
      : null;

    const tierNames = await this.entitlementsService.getActiveTierNamesByUserIds(
      room.community.creatorId,
      data.map((m) => m.userId),
    );

    return {
      data: data.reverse().map((m) => toPublicRoomMessage(m, tierNames.get(m.userId) ?? null)),
      meta: { cursor: nextCursor, hasMore },
    };
  }

  async sendMessage(
    communityId: string,
    roomId: string,
    userId: string,
    body: string,
    parentMessageId?: string,
    viewerRole?: UserRole | null,
  ) {
    const community = await this.communitiesService.assertCommunityAccess(
      communityId,
      userId,
      viewerRole,
    );
    await this.getTextRoom(communityId, roomId);
    await this.roomPermissionsService.assertRoomPermissionIfRestricted(
      communityId,
      roomId,
      userId,
      CommunityRoomPermission.SEND,
      viewerRole,
    );

    if (await this.moderationService.isBanned(communityId, userId)) {
      throw new ForbiddenException('You are banned from this community');
    }

    const trimmed = body?.trim();
    if (!trimmed) throw new BadRequestException('Message body required');

    const spam = this.aiCommunityService.scoreContent(trimmed);
    if (spam.flagged) {
      void this.moderationQueueService.enqueueFlaggedMessage({
        communityId,
        channelId: roomId,
        userId,
        messageBody: trimmed,
        score: spam.score,
        reasons: spam.reasons,
        detectedBy: 'fast_path',
        surface: 'room',
      });
      throw new ForbiddenException('Message blocked by automated moderation');
    }

    if (community.visibility === 'paid') {
      await this.accessSessionsService.requirePremiumSession(
        userId,
        community.creatorId,
        AccessSessionType.COMMUNITY,
        communityId,
      );
    }

    const key = `room:msg:rate:${roomId}:${userId}`;
    const set = await this.redis.set(key, '1', 'EX', 3, 'NX');
    if (set !== 'OK') {
      throw new ForbiddenException('Slow down — wait before sending another message');
    }

    if (parentMessageId) {
      const parent = await this.messageRepository.findOne({
        where: { id: parentMessageId, roomId },
      });
      if (!parent || parent.deletedAt) {
        throw new BadRequestException('Parent message not found in this room');
      }
    }

    const msg = await this.messageRepository.save(
      this.messageRepository.create({
        roomId,
        userId,
        body: trimmed,
        parentMessageId: parentMessageId ?? null,
      }),
    );

    const full = await this.messageRepository.findOne({
      where: { id: msg.id },
      relations: ['user'],
    });

    this.moderationQueueService.maybeQueueLlmTail({
      communityId,
      surface: 'room',
      surfaceId: roomId,
      userId,
      messageId: msg.id,
      body: trimmed,
      fastPathScore: spam.score,
    });

    const tierNames = await this.entitlementsService.getActiveTierNamesByUserIds(
      community.creatorId,
      [userId],
    );
    const publicMsg = toPublicRoomMessage(full!, tierNames.get(userId) ?? null);
    this.eventEmitter.emit('room.message', { communityId, roomId, message: publicMsg });
    await this.emitChannelBridge(roomId, publicMsg);
    this.eventEmitter.emit('community.activity', {
      userId,
      communityId,
      xp: 2,
      source: 'room_message',
    });
    return publicMsg;
  }

  async deleteMessage(
    communityId: string,
    roomId: string,
    messageId: string,
    actorId: string,
    viewerRole?: UserRole | null,
  ) {
    const community = await this.communitiesService.assertCommunityAccess(
      communityId,
      actorId,
      viewerRole,
    );
    await this.getTextRoom(communityId, roomId);

    const msg = await this.messageRepository.findOne({ where: { id: messageId, roomId } });
    if (!msg || msg.deletedAt) throw new NotFoundException('Message not found');

    const canModerate = await this.communitiesService.canModerateCommunity(
      communityId,
      community.creatorId,
      actorId,
      viewerRole,
    );
    const hasRoomModerate = await this.roomPermissionsService.hasRoomPermission(
      communityId,
      roomId,
      actorId,
      CommunityRoomPermission.MODERATE,
      viewerRole,
    );
    if (msg.userId !== actorId && !canModerate && !hasRoomModerate) {
      throw new ForbiddenException('Cannot delete this message');
    }

    msg.deletedAt = new Date();
    await this.messageRepository.save(msg);
    this.eventEmitter.emit('room.message.deleted', { communityId, roomId, messageId });
    const channelId = await this.channelMigrationService.resolveChannelIdForRoom(roomId);
    if (channelId) {
      this.eventEmitter.emit('channel.message.deleted', { channelId, messageId });
    }
    return { id: messageId, deleted: true };
  }
}
