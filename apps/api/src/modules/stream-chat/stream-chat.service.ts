import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StreamMessage } from './entities/stream-message.entity';
import { StreamModerationAction } from './entities/stream-moderation-action.entity';
import { SendStreamChatDto, TimeoutUserDto } from './dto/stream-chat.dto';
import { toPublicStreamMessage } from './stream-chat.mapper';
import { StreamingService } from '../streaming/streaming.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { UserRole } from '../users/entities/user.entity';
import {
  safeRedisDel,
  safeRedisGet,
  safeRedisSetNx,
  safeRedisSetex,
} from '../../common/redis/redis-safe.util';

@Injectable()
export class StreamChatService {
  private readonly logger = new Logger(StreamChatService.name);

  constructor(
    @InjectRepository(StreamMessage)
    private readonly messageRepository: Repository<StreamMessage>,
    @InjectRepository(StreamModerationAction)
    private readonly moderationRepository: Repository<StreamModerationAction>,
    @Inject(forwardRef(() => StreamingService))
    private readonly streamingService: StreamingService,
    private readonly entitlementsService: EntitlementsService,
    private readonly eventEmitter: EventEmitter2,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async getMessages(
    streamId: string,
    limit = 50,
    cursor?: string,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ) {
    const stream = await this.streamingService.findById(streamId);
    const isOwner = !!viewerId && viewerId === stream.userId;
    const isAdmin = viewerRole === UserRole.ADMIN;

    if (!stream.chatEnabled) {
      throw new ForbiddenException('Chat is disabled for this stream');
    }

    if (!isOwner && !isAdmin) {
      await this.entitlementsService.assertAccessAsync({
        creatorId: stream.userId,
        visibility: stream.visibility,
        requiredTierId: stream.requiredTierId,
        viewerId,
      });
    }

    if (!cursor) {
      const cacheKey = `stream:chat:page:${streamId}`;
      const cached = await safeRedisGet(this.redis, cacheKey, this.logger);
      if (cached) {
        try {
          return JSON.parse(cached) as {
            data: ReturnType<typeof toPublicStreamMessage>[];
            meta: { cursor: string | null; hasMore: boolean };
          };
        } catch {
          await safeRedisDel(this.redis, cacheKey, this.logger);
        }
      }
    }

    const query = this.messageRepository
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.user', 'user')
      .where('m.stream_id = :streamId', { streamId })
      .orderBy('m.created_at', 'DESC')
      .take(limit + 1);

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

    const result = {
      data: data.reverse().map(toPublicStreamMessage),
      meta: { cursor: nextCursor, hasMore },
    };

    if (!cursor) {
      await safeRedisSetex(this.redis, `stream:chat:page:${streamId}`, 5, JSON.stringify(result), this.logger);
    }

    return result;
  }

  async sendMessage(
    streamId: string,
    userId: string,
    dto: SendStreamChatDto,
    viewerRole?: UserRole | null,
  ) {
    const stream = await this.streamingService.findById(streamId);
    if (!stream.chatEnabled) {
      throw new ForbiddenException('Chat is disabled for this stream');
    }

    const isOwner = userId === stream.userId;
    const isAdmin = viewerRole === UserRole.ADMIN;

    if (!isOwner && !isAdmin) {
      await this.entitlementsService.assertAccessAsync({
        creatorId: stream.userId,
        visibility: stream.visibility,
        requiredTierId: stream.requiredTierId,
        viewerId: userId,
      });
    }

    await this.assertNotTimedOut(streamId, userId);
    await this.assertRateLimit(streamId, userId, stream.slowModeSeconds);

    const msg = this.messageRepository.create({
      streamId,
      userId,
      body: dto.body.trim(),
      parentId: dto.parentId ?? null,
    });
    const saved = await this.messageRepository.save(msg);
    const full = await this.messageRepository.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });

    const publicMsg = toPublicStreamMessage(full!);
    await safeRedisDel(this.redis, `stream:chat:page:${streamId}`, this.logger);
    this.eventEmitter.emit('stream.chat.message', { streamId, message: publicMsg });
    return publicMsg;
  }

  async deleteMessage(
    streamId: string,
    messageId: string,
    requesterId: string,
    requesterRole?: UserRole | null,
  ) {
    const stream = await this.streamingService.findById(streamId);
    const msg = await this.messageRepository.findOne({ where: { id: messageId, streamId } });
    if (!msg) throw new NotFoundException('Message not found');

    const canMod =
      requesterId === stream.userId ||
      requesterId === msg.userId ||
      requesterRole === UserRole.ADMIN;
    if (!canMod) throw new ForbiddenException();

    msg.deletedAt = new Date();
    await this.messageRepository.save(msg);
    this.eventEmitter.emit('stream.chat.delete', { streamId, messageId });
    return { ok: true };
  }

  async timeoutUser(
    streamId: string,
    requesterId: string,
    dto: TimeoutUserDto,
    requesterRole?: UserRole | null,
  ) {
    const stream = await this.streamingService.findById(streamId);
    if (requesterId !== stream.userId && requesterRole !== UserRole.ADMIN) {
      throw new ForbiddenException();
    }

    const duration = dto.durationSeconds ?? 300;
    const expiresAt = new Date(Date.now() + duration * 1000);

    await this.moderationRepository.save(
      this.moderationRepository.create({
        streamId,
        targetUserId: dto.targetUserId,
        action: 'timeout',
        expiresAt,
        createdById: requesterId,
      }),
    );

    return { ok: true, expiresAt };
  }

  private async assertNotTimedOut(streamId: string, userId: string) {
    const now = new Date();
    const active = await this.moderationRepository
      .createQueryBuilder('m')
      .where('m.stream_id = :streamId', { streamId })
      .andWhere('m.target_user_id = :userId', { userId })
      .andWhere('m.action = :action', { action: 'timeout' })
      .andWhere('m.expires_at > :now', { now })
      .orderBy('m.created_at', 'DESC')
      .getOne();
    if (active) {
      throw new ForbiddenException('You are timed out from this chat');
    }
  }

  private async assertRateLimit(streamId: string, userId: string, slowModeSeconds: number) {
    const minInterval = Math.max(slowModeSeconds, 2);
    const key = `stream:chat:rate:${streamId}:${userId}`;
    const allowed = await safeRedisSetNx(this.redis, key, '1', minInterval, this.logger);
    if (!allowed) {
      throw new HttpException('Slow down — wait before sending another message', HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
